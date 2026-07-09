// Company Panel — Employee Leave Requests
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Clock,
  User,
  AlertCircle,
  Loader2,
  Trash2,
  LayoutList,
  CalendarDays,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import DataTable from "@/components/common/DataTable";
import ModernCalendar from "@/components/common/ModernCalendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a date string to a local-midnight Date to avoid UTC shifts */
function toLocalDate(dateStr) {
  const s = dateStr.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Status config ─────────────────────────────────────────────────────────────

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Clock,
  },
  pending_secondary: {
    label: "Pending Final Approval",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400",
    icon: XCircle,
  },
};

const StatusBadge = ({ status }) => {
  const config = statusConfig[status];
  if (!config) return status;
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={`${config.color} border-0`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function SupervisorLeaveRequests() {
  const { token } = useAuthStore();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  // Leave credits matrix
  const [leaveMatrix, setLeaveMatrix] = useState([]); // [{ email, balances: { [type]: { credits, used, available } } }]
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [matrixLoading, setMatrixLoading] = useState(false);

  const matrixByEmail = useMemo(() => {
    const map = {};
    leaveMatrix.forEach((row) => { if (row.email) map[row.email.toLowerCase()] = row; });
    return map;
  }, [leaveMatrix]);

  // View mode
  const [viewMode, setViewMode] = useState("table"); // "table" | "calendar"

  // Calendar state
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  // Dialog states
  const [detailDialog, setDetailDialog] = useState({ open: false, request: null });
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, request: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, request: null });
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Two-step approval
  const [multiApprovalEnabled, setMultiApprovalEnabled] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [requireSecondApproval, setRequireSecondApproval] = useState(false);
  const [escalateTo, setEscalateTo] = useState("");

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: leaves.length,
    pending: leaves.filter(r => r.status === "pending").length,
    pendingSecondary: leaves.filter(r => r.status === "pending_secondary").length,
    approved: leaves.filter(r => r.status === "approved").length,
    rejected: leaves.filter(r => r.status === "rejected").length,
  }), [leaves]);

  // ── Calendar data ─────────────────────────────────────────────────────────

  /**
   * leavesByDate: { "YYYY-MM-DD": [leave, ...] }
   * A leave spans every calendar day from startDate to endDate (inclusive).
   */
  const leavesByDate = useMemo(() => {
    const map = {};
    leaves.forEach((leave) => {
      const start = toLocalDate(leave.startDate);
      const end = toLocalDate(leave.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const key = format(cur, "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(leave);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [leaves]);

  const selectedDateLeaves = useMemo(() => {
    if (!selectedDate) return [];
    return leavesByDate[format(selectedDate, "yyyy-MM-dd")] || [];
  }, [selectedDate, leavesByDate]);

  // ── Table config ──────────────────────────────────────────────────────────

  const statusTabs = useMemo(() => [
    { label: "All", value: "all", count: stats.total },
    { label: "Pending", value: "pending", count: stats.pending },
    { label: "Pending Final", value: "pending_secondary", count: stats.pendingSecondary },
    { label: "Approved", value: "approved", count: stats.approved },
    { label: "Rejected", value: "rejected", count: stats.rejected },
  ], [stats]);

  const columns = [
    {
      key: "requester",
      label: "Employee",
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="font-medium">{row.requester?.email || row.User?.email || "Unknown"}</div>
            <div className="text-xs text-muted-foreground">
              {row.requester?.department?.name || row.User?.department?.name || "No department"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "leaveType",
      label: "Leave Type",
      render: (type) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
            <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <span className="font-medium">{type}</span>
        </div>
      ),
    },
    {
      key: "dateRange",
      label: "Date Range",
      render: (_, row) => {
        const start = toLocalDate(row.startDate);
        const end = toLocalDate(row.endDate);
        const diffDays = Math.floor((end - start) / 86400000) + 1;
        return (
          <div className="text-sm">
            <div className="font-medium">{start.toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">to {end.toLocaleDateString()}</div>
            <div className="text-xs text-orange-600 font-medium">{diffDays} day{diffDays === 1 ? "" : "s"}</div>
          </div>
        );
      },
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (status) => <StatusBadge status={status} />,
      sortable: true,
    },
    {
      key: "isPaid",
      label: "Pay Type",
      render: (isPaid) => isPaid === undefined ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : (
        <Badge variant="secondary" className={isPaid
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"
        }>
          <DollarSign className="h-3 w-3 mr-1" />
          {isPaid ? "Paid" : "Unpaid"}
        </Badge>
      ),
    },
    {
      key: "leaveReason",
      label: "Reason",
      render: (reason) => (
        <div className="max-w-32 truncate text-sm text-muted-foreground">
          {reason || "No reason provided"}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Submitted",
      render: (date) => (
        <div className="text-sm text-muted-foreground">{new Date(date).toLocaleDateString()}</div>
      ),
      sortable: true,
    },
  ];

  const actions = [
    {
      label: "View Details",
      icon: Eye,
      onClick: (request) => setDetailDialog({ open: true, request }),
    },
    {
      label: "Approve",
      icon: CheckCircle2,
      onClick: (request) => setActionDialog({ open: true, type: "approve", request }),
      condition: (request) => (request.status === "pending" || request.status === "pending_secondary") && request.canAct === true,
      className: "text-green-600 hover:text-green-700",
    },
    {
      label: "Reject",
      icon: XCircle,
      onClick: (request) => setActionDialog({ open: true, type: "reject", request }),
      condition: (request) => (request.status === "pending" || request.status === "pending_secondary") && request.canAct === true,
      className: "text-red-600 hover:text-red-700",
    },
  ];

  // ── API handlers ──────────────────────────────────────────────────────────

  const fetchCompanySettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/company-settings/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setMultiApprovalEnabled(data.data?.multiApprovalEnabled ?? false);
    } catch (_) {}
  }, [token]);

  const fetchApprovers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/leaves/approvers`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setApprovers(data.data || []);
    } catch (_) {}
  }, [token]);

  const fetchLeaves = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch leave requests");
      setLeaves(data.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to fetch leave requests");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchLeaveMatrix = useCallback(async () => {
    if (!token) return;
    setMatrixLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch(`${API_URL}/api/leave-balances/matrix`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/leave-policies`,         { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [mData, pData] = await Promise.all([mRes.json(), pRes.json()]);
      if (!mRes.ok || !pRes.ok) return;
      const types = Array.isArray(pData.data) ? pData.data.map((p) => p.leaveType) : [];
      const rows  = Array.isArray(mData.data) ? mData.data : [];
      setLeaveTypes(types);
      setLeaveMatrix(rows.map((row) => {
        const balances = {};
        types.forEach((t) => {
          const credits   = Number(row.balances?.[t]    || 0);
          const used      = Number(row.usedBalances?.[t] || 0);
          balances[t] = { credits, used, available: Math.max(credits - used, 0) };
        });
        return { ...row, balances };
      }));
    } catch (_) {
      // silently fail — credits are supplemental info
    } finally {
      setMatrixLoading(false);
    }
  }, [token]);

  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null, request: null });
    setComment("");
    setRequireSecondApproval(false);
    setEscalateTo("");
  };

  const handleAction = async () => {
    if (!actionDialog.request || !actionDialog.type) return;
    const employeeEmail = actionDialog.request.requester?.email || actionDialog.request.User?.email || "the employee";
    const type = actionDialog.type;
    setActionLoading(true);
    try {
      const body = { approverComments: comment.trim() || null };
      if (type === "approve" && requireSecondApproval && escalateTo) body.escalateTo = escalateTo;
      const res = await fetch(`${API_URL}/api/leaves/${actionDialog.request.id}/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        closeActionDialog();
        if (data.debug?.available !== undefined) {
          toast("Insufficient Leave Balance", {
            description: `${employeeEmail} has ${data.debug.available}h available but needs ${data.debug.requested}h for ${data.debug.leaveType || "this leave"}.`,
            icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
            duration: 8000,
          });
        } else {
          toast.error(data.message || `Failed to ${type} leave request`);
        }
        setActionLoading(false);
        return;
      }
      toast.success(`Leave request ${type}d successfully!`);
      closeActionDialog();
      fetchLeaves();
      fetchLeaveMatrix();
    } catch (err) {
      closeActionDialog();
      toast.error(err.message || `Failed to ${type} leave request`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.request) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leaves/${deleteDialog.request.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete leave request");
      toast.success("Leave request deleted successfully!");
      setDeleteDialog({ open: false, request: null });
      fetchLeaves();
    } catch (err) {
      toast.error(err.message || "Failed to delete leave request");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchLeaveMatrix();
    fetchCompanySettings();
    fetchApprovers();
  }, [fetchLeaves, fetchLeaveMatrix, fetchCompanySettings, fetchApprovers]);

  const goToToday = () => {
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Toaster position="top-center" />
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Leave Requests</h1>
            <p className="text-muted-foreground">Review and manage employee leave requests</p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                viewMode === "table"
                  ? "bg-white dark:bg-neutral-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="h-4 w-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                viewMode === "calendar"
                  ? "bg-white dark:bg-neutral-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-amber-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Final</CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.pendingSecondary}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* ── Table View ── */}
        {viewMode === "table" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                <CardTitle>Employee Leave Requests</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <DataTable
                data={leaves}
                columns={columns}
                loading={loading}
                onRefresh={fetchLeaves}
                actions={actions}
                searchPlaceholder="Search by employee, leave type, or reason..."
                statusTabs={statusTabs}
                onRowClick={(request) => setDetailDialog({ open: true, request })}
                pageSize={10}
              />
            </CardContent>
          </Card>
        )}

        {/* ── Calendar View ── */}
        {viewMode === "calendar" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

            {/* Calendar grid */}
            <Card className="xl:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-base">Leave Calendar</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={goToToday}>
                    Today
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    Pending
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    Pending Final
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    Approved
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    Rejected
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ModernCalendar
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  currentMonth={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  loading={loading}
                  getDayIndicators={(date) => {
                    const dayLeaves = leavesByDate[format(date, "yyyy-MM-dd")] || [];
                    const indicators = [];
                    if (dayLeaves.some(l => l.status === "pending"))           indicators.push({ color: "bg-amber-400" });
                    if (dayLeaves.some(l => l.status === "pending_secondary")) indicators.push({ color: "bg-blue-400" });
                    if (dayLeaves.some(l => l.status === "approved"))          indicators.push({ color: "bg-green-500" });
                    if (dayLeaves.some(l => l.status === "rejected"))          indicators.push({ color: "bg-red-400" });
                    return indicators;
                  }}
                  getDayTooltip={(date) => {
                    const dayLeaves       = leavesByDate[format(date, "yyyy-MM-dd")] || [];
                    const pending          = dayLeaves.filter(l => l.status === "pending").length;
                    const pendingSecondary = dayLeaves.filter(l => l.status === "pending_secondary").length;
                    const approved         = dayLeaves.filter(l => l.status === "approved").length;
                    const rejected         = dayLeaves.filter(l => l.status === "rejected").length;
                    return (
                      <div className="text-sm">
                        <div className="font-medium">{format(date, "MMM d, yyyy")}</div>
                        {dayLeaves.length > 0 && (
                          <div className="mt-1 space-y-0.5 text-xs">
                            <div>{dayLeaves.length} on leave</div>
                            {pending          > 0 && <div className="text-amber-400">{pending} pending</div>}
                            {pendingSecondary > 0 && <div className="text-blue-400">{pendingSecondary} pending final</div>}
                            {approved         > 0 && <div className="text-green-400">{approved} approved</div>}
                            {rejected         > 0 && <div className="text-red-400">{rejected} rejected</div>}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
              </CardContent>
            </Card>

            {/* Selected date detail panel */}
            <Card className="xl:col-span-1 xl:sticky xl:top-6">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {selectedDate
                        ? selectedDate.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                        : "Select a date"}
                    </CardTitle>
                    {selectedDateLeaves.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedDateLeaves.length} leave{selectedDateLeaves.length > 1 ? "s" : ""} on this day
                      </p>
                    )}
                  </div>
                  {selectedDateLeaves.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      {selectedDateLeaves.filter(l => l.status === "pending").length > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-semibold">
                          {selectedDateLeaves.filter(l => l.status === "pending").length} pending
                        </span>
                      )}
                      {selectedDateLeaves.filter(l => l.status === "pending_secondary").length > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold">
                          {selectedDateLeaves.filter(l => l.status === "pending_secondary").length} pending final
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {selectedDateLeaves.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No leave requests</p>
                    <p className="text-xs text-muted-foreground mt-1">No one is on leave this day</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {selectedDateLeaves.map((leave) => {
                      const email = leave.requester?.email || leave.User?.email || "Unknown";
                      const dept  = leave.requester?.department?.name || leave.User?.department?.name;
                      const start = toLocalDate(leave.startDate);
                      const end   = toLocalDate(leave.endDate);
                      const days  = Math.floor((end - start) / 86400000) + 1;

                      return (
                        <div key={leave.id} className="p-4 hover:bg-muted/40 transition-colors">
                          {/* Employee + status row */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{email}</p>
                                {dept && <p className="text-xs text-muted-foreground truncate">{dept}</p>}
                              </div>
                            </div>
                            <StatusBadge status={leave.status} />
                          </div>

                          {/* Leave type + duration */}
                          <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-orange-500" />
                              {leave.leaveType}
                            </span>
                            <span className="text-orange-600 font-medium">
                              {start.toLocaleDateString("default", { month: "short", day: "numeric" })}
                              {days > 1 && ` – ${end.toLocaleDateString("default", { month: "short", day: "numeric" })}`}
                              {" "}({days}d)
                            </span>
                          </div>

                          {/* Actions */}
                          {(leave.status === "pending" || leave.status === "pending_secondary") && leave.canAct === true && (
                            <p className="text-[11px] text-muted-foreground mt-2 italic">
                              {leave.status === "pending_secondary"
                                ? "Awaiting your final approval"
                                : "Awaiting your approval"}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs flex-1"
                              onClick={() => setDetailDialog({ open: true, request: leave })}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            {(leave.status === "pending" || leave.status === "pending_secondary") && leave.canAct === true && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs flex-1 bg-green-500 hover:bg-green-600 text-white"
                                  onClick={() => setActionDialog({ open: true, type: "approve", request: leave })}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs flex-1 bg-red-500 hover:bg-red-600 text-white"
                                  onClick={() => setActionDialog({ open: true, type: "reject", request: leave })}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Detail Dialog ── */}
        <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, request: null })}>
          <DialogContent className="sm:max-w-lg">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                Leave Request Details
              </DialogTitle>
            </DialogHeader>

            {detailDialog.request && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={detailDialog.request.status} />
                    {detailDialog.request.isPaid !== undefined && (
                      <Badge variant="secondary" className={detailDialog.request.isPaid
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"
                      }>
                        <DollarSign className="h-3 w-3 mr-1" />
                        {detailDialog.request.isPaid ? "Paid" : "Unpaid"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{detailDialog.request.leaveType}</div>
                    <div className="text-sm text-muted-foreground">Leave Type</div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-blue-600" />
                    <div className="font-medium text-blue-700 dark:text-blue-300">Employee Information</div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {(() => {
                      const req = detailDialog.request.requester || detailDialog.request.User;
                      const fullName = req?.name || [req?.profile?.firstName, req?.profile?.lastName].filter(Boolean).join(" ") || [req?.firstName, req?.lastName].filter(Boolean).join(" ");
                      return fullName ? (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">{fullName}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{detailDialog.request.requester?.email || detailDialog.request.User?.email || "Unknown"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Department:</span>
                      <span className="font-medium">{detailDialog.request.requester?.department?.name || detailDialog.request.User?.department?.name || "Not specified"}</span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const primary = detailDialog.request.approver;
                  const secondary = detailDialog.request.secondApprover;
                  if (!primary && !secondary) return null;
                  return (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                        <div className="font-medium text-indigo-700 dark:text-indigo-300">Approver</div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        {primary && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Primary:</span>
                            <span className="font-medium">{primary.name || primary.email || "—"}</span>
                          </div>
                        )}
                        {secondary && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Secondary:</span>
                            <span className="font-medium">{secondary.name || secondary.email || "—"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Leave Credits */}
                {(() => {
                  const email = (detailDialog.request.requester?.email || detailDialog.request.User?.email || "").toLowerCase();
                  const row   = matrixByEmail[email];
                  if (!row && !matrixLoading) return null;
                  return (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-purple-600" />
                          <div className="font-medium text-purple-700 dark:text-purple-300">Leave Credits</div>
                        </div>
                        {matrixLoading && <Loader2 className="h-3 w-3 animate-spin text-purple-400" />}
                      </div>
                      {row ? (
                        <div className="space-y-2">
                          {leaveTypes.map((type) => {
                            const bal = row.balances?.[type] || { credits: 0, used: 0, available: 0 };
                            const isRequested = type === detailDialog.request.leaveType;
                            return (
                              <div key={type} className={`flex items-center justify-between text-sm rounded px-2 py-1 ${isRequested ? "bg-purple-100 dark:bg-purple-800/30 font-semibold" : ""}`}>
                                <span className={isRequested ? "text-purple-700 dark:text-purple-300" : "text-muted-foreground"}>
                                  {isRequested && "▶ "}{type}
                                </span>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-muted-foreground">{bal.credits}h total</span>
                                  <span className="text-amber-600">{bal.used}h used</span>
                                  <span className={`font-bold ${bal.available > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                    {bal.available}h left
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Loading credits...</p>
                      )}
                    </div>
                  );
                })()}

                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-orange-600" />
                    <div className="font-medium text-orange-700 dark:text-orange-300">Leave Period</div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start Date:</span>
                      <span className="font-medium">{toLocalDate(detailDialog.request.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">End Date:</span>
                      <span className="font-medium">{toLocalDate(detailDialog.request.endDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium text-orange-600">
                        {(() => {
                          const s = toLocalDate(detailDialog.request.startDate);
                          const e = toLocalDate(detailDialog.request.endDate);
                          const d = Math.floor((e - s) / 86400000) + 1;
                          return `${d} day${d === 1 ? "" : "s"}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Request ID</div>
                    <div className="font-mono text-xs">{detailDialog.request.id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Submitted</div>
                    <div className="font-medium">
                      {new Date(detailDialog.request.createdAt).toLocaleDateString()}{" "}
                      {new Date(detailDialog.request.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>

                {detailDialog.request.leaveReason && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Reason for Leave</div>
                    <div className="bg-muted p-3 rounded-md text-sm">{detailDialog.request.leaveReason}</div>
                  </div>
                )}

                {detailDialog.request.approverComments && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      {detailDialog.request.status === "approved" ? "Approval" : "Rejection"} Comments
                    </div>
                    <div className={`p-3 rounded-md text-sm border ${
                      detailDialog.request.status === "approved"
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    }`}>
                      {detailDialog.request.approverComments}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {(detailDialog.request?.status === "pending" || detailDialog.request?.status === "pending_secondary") && detailDialog.request?.canAct === true ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setDetailDialog({ open: false, request: null }); setActionDialog({ open: true, type: "reject", request: detailDialog.request }); }}
                    className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                  <Button
                    onClick={() => { setDetailDialog({ open: false, request: null }); setActionDialog({ open: true, type: "approve", request: detailDialog.request }); }}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                  </Button>
                </>
              ) : (
                <Button onClick={() => setDetailDialog({ open: false, request: null })}>Close</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Approve/Reject Dialog ── */}
        <Dialog open={actionDialog.open} onOpenChange={(open) => !open && closeActionDialog()}>
          <DialogContent className="sm:max-w-md">
            <div className={`h-1 w-full -mt-6 mb-4 ${actionDialog.type === "approve" ? "bg-green-500" : "bg-red-500"}`} />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className={`p-2 rounded-full ${
                  actionDialog.type === "approve"
                    ? "bg-green-100 text-green-500 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {actionDialog.type === "approve" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                {actionDialog.type === "approve" ? "Approve" : "Reject"} Leave Request
              </DialogTitle>
            </DialogHeader>

            {actionDialog.request && (
              <>
                <div className={`p-4 rounded-md border ${
                  actionDialog.type === "approve"
                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                    : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                }`}>
                  <div className="text-sm space-y-1">
                    <div><strong>Employee:</strong> {actionDialog.request.requester?.email || actionDialog.request.User?.email || "Unknown"}</div>
                    <div><strong>Leave Type:</strong> {actionDialog.request.leaveType}</div>
                  </div>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <div className="font-semibold text-sm text-orange-700 dark:text-orange-300">Leave Period Details</div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start:</span>
                      <span className="font-medium">{toLocalDate(actionDialog.request.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">End:</span>
                      <span className="font-medium">{toLocalDate(actionDialog.request.endDate).toLocaleDateString()}</span>
                    </div>
                    <div className="h-px bg-orange-200 dark:bg-orange-800 my-1" />
                    {(() => {
                      const s = toLocalDate(actionDialog.request.startDate);
                      const e = toLocalDate(actionDialog.request.endDate);
                      const d = Math.floor((e - s) / 86400000) + 1;
                      return (
                        <>
                          <div className="flex justify-between"><span className="text-muted-foreground">Days:</span><span className="font-medium">{d}</span></div>
                          <div className="flex justify-between"><span className="font-semibold text-orange-700 dark:text-orange-300">Total Hours:</span><span className="font-bold text-orange-600">{d * 8}h</span></div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* Credit balance for the requested leave type */}
            {actionDialog.request && (() => {
              const email = (actionDialog.request.requester?.email || actionDialog.request.User?.email || "").toLowerCase();
              const row   = matrixByEmail[email];
              const type  = actionDialog.request.leaveType;
              const bal   = row?.balances?.[type];
              if (!bal && !matrixLoading) return null;
              const s = toLocalDate(actionDialog.request.startDate);
              const e = toLocalDate(actionDialog.request.endDate);
              const days = Math.floor((e - s) / 86400000) + 1;
              const requestedHours = days * 8;
              const willExceed = bal && bal.available < requestedHours;
              return (
                <div className={`p-4 rounded-md border ${willExceed ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" : "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className={`h-4 w-4 ${willExceed ? "text-red-600" : "text-purple-600"}`} />
                      <div className={`font-semibold text-sm ${willExceed ? "text-red-700 dark:text-red-300" : "text-purple-700 dark:text-purple-300"}`}>
                        {type} Balance
                      </div>
                    </div>
                    {matrixLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  {bal ? (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Credits:</span>
                        <span className="font-medium">{bal.credits}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Already Used:</span>
                        <span className="font-medium text-amber-600">{bal.used}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Available:</span>
                        <span className={`font-bold ${bal.available > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{bal.available}h</span>
                      </div>
                      <div className="h-px bg-current opacity-10 my-1" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">This Request:</span>
                        <span className="font-semibold">{requestedHours}h ({days}d)</span>
                      </div>
                      {willExceed && (
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                          Exceeds available balance by {requestedHours - bal.available}h
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Loading credits...</p>
                  )}
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="text-sm font-medium">Comments <span className="text-muted-foreground">(optional)</span></label>
              <Textarea
                placeholder={`Add a comment for this ${actionDialog.type}...`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {actionDialog.type === "approve" && multiApprovalEnabled && (
              <div className="space-y-3 border rounded-md p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requireSecondApproval"
                    checked={requireSecondApproval}
                    onCheckedChange={(v) => { setRequireSecondApproval(!!v); if (!v) setEscalateTo(""); }}
                  />
                  <label htmlFor="requireSecondApproval" className="text-sm font-medium text-blue-700 dark:text-blue-300 cursor-pointer">
                    Require second approval
                  </label>
                </div>
                {requireSecondApproval && (
                  <Select value={escalateTo} onValueChange={setEscalateTo}>
                    <SelectTrigger className="bg-white dark:bg-neutral-900">
                      <SelectValue placeholder="Select second approver…" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvers.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name || a.email} {a.role ? `(${a.role})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={closeActionDialog}>Cancel</Button>
              <Button
                onClick={handleAction}
                disabled={actionLoading || (actionDialog.type === "approve" && requireSecondApproval && !escalateTo)}
                className={actionDialog.type === "approve" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}
              >
                {actionLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{actionDialog.type === "approve" ? "Approving..." : "Rejecting..."}</>
                ) : (
                  <>{actionDialog.type === "approve" ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}{actionDialog.type === "approve" ? "Approve" : "Reject"}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Dialog ── */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, request: null })}>
          <DialogContent className="sm:max-w-md">
            <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400">
                  <AlertCircle className="h-5 w-5" />
                </div>
                Delete Leave Request
              </DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>

            {deleteDialog.request && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 text-sm space-y-1 text-red-600 dark:text-red-400">
                <div><strong>Employee:</strong> {deleteDialog.request.requester?.email || deleteDialog.request.User?.email || "Unknown"}</div>
                <div><strong>Leave Type:</strong> {deleteDialog.request.leaveType}</div>
                <div><strong>Duration:</strong> {toLocalDate(deleteDialog.request.startDate).toLocaleDateString()} to {toLocalDate(deleteDialog.request.endDate).toLocaleDateString()}</div>
                <div><strong>Status:</strong> {deleteDialog.request.status}</div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, request: null })}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={actionLoading} className="bg-red-500 hover:bg-red-600">
                {actionLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : <><Trash2 className="h-4 w-4 mr-2" />Delete Request</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </>
  );
}
