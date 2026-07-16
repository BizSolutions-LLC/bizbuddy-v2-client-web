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
  Download,
  Search,
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
const PER_PAGE = 10;
import ModernCalendar from "@/components/common/ModernCalendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CutoffDateRangeFilter, { periodRangeKey } from "@/components/common/CutoffDateRangeFilter";
import { normalizeLeaveMatrixRow, resolveLeavePayOutcome } from "@/lib/leaveBalanceUtils";

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

// Detail-panel section label + label/value row — matches the employee-side
// LeaveLogs.jsx panel's plain list presentation (no boxed cards).
const DetailSectionLabel = ({ children }) => (
  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mt-4 mb-2 first:mt-0">{children}</div>
);
const DetailRow = ({ label, value, valueClassName = "" }) => (
  <div className="flex items-baseline justify-between gap-2 mb-1.5">
    <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
    <span className={`text-xs font-medium text-right ${valueClassName}`}>{value}</span>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function SupervisorLeaveRequests() {
  const { token } = useAuthStore();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Leave credits matrix
  const [leaveMatrix, setLeaveMatrix] = useState([]); // [{ email, balances: { [type]: { credits, used, available } } }]
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Per-request paid/unpaid breakdown — GET /:id/preview, fetched when the approve/reject dialog opens
  const [preview, setPreview] = useState(null); // { isPaid, availableBalance, paidHours, unpaidHours, days: [{date,hours,isPaid}] }
  const [previewLoading, setPreviewLoading] = useState(false);

  // Actual day-by-day paid/unpaid outcome — GET /:id/days, fetched when the detail dialog opens on a decided request
  const [dayBreakdown, setDayBreakdown] = useState([]);
  const [dayBreakdownLoading, setDayBreakdownLoading] = useState(false);

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

  // ── Inline table state ────────────────────────────────────────────────────

  const [tableSearch,    setTableSearch]    = useState("");
  const [tableSortKey,   setTableSortKey]   = useState("createdAt");
  const [tableSortDir,   setTableSortDir]   = useState(-1);
  const [tablePage,      setTablePage]      = useState(1);
  const [tableActiveTab, setTableActiveTab] = useState("all");
  const [tableDateFrom,    setTableDateFrom]    = useState("");
  const [tableDateTo,      setTableDateTo]      = useState("");
  const [tablePendingFrom, setTablePendingFrom] = useState("");
  const [tablePendingTo,   setTablePendingTo]   = useState("");
  const [cutoffPeriods,    setCutoffPeriods]    = useState([]);
  const [selectedCutoffId, setSelectedCutoffId] = useState("all");

  const tableFiltered = useMemo(() => {
    let list = leaves;
    if (tableActiveTab !== "all") list = list.filter(r => r.status === tableActiveTab);
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      list = list.filter(r => {
        const req  = r.requester || r.User;
        const name = req?.name || [req?.profile?.firstName, req?.profile?.lastName].filter(Boolean).join(" ") || [req?.firstName, req?.lastName].filter(Boolean).join(" ") || req?.email || "";
        return name.toLowerCase().includes(q) || (r.leaveType ?? "").toLowerCase().includes(q) || (r.status ?? "").toLowerCase().includes(q);
      });
    }
    if (tableDateFrom || tableDateTo) {
      // Overlap check against the leave's own [startDate, endDate] span, not just its
      // start — a multi-day leave that merely crosses into the selected range should
      // still show up, not just ones that start inside it.
      list = list.filter(r => {
        if (!r.startDate) return false;
        const s = r.startDate.slice(0, 10);
        const e = (r.endDate || r.startDate).slice(0, 10);
        return (!tableDateFrom || e >= tableDateFrom) && (!tableDateTo || s <= tableDateTo);
      });
    }
    return [...list].sort((a, b) => {
      const av = a[tableSortKey] ?? "", bv = b[tableSortKey] ?? "";
      return av > bv ? tableSortDir : av < bv ? -tableSortDir : 0;
    });
  }, [leaves, tableActiveTab, tableSearch, tableSortKey, tableSortDir, tableDateFrom, tableDateTo]);

  const tableTotalPages = Math.max(1, Math.ceil(tableFiltered.length / PER_PAGE));
  const tablePaginated  = tableFiltered.slice((tablePage - 1) * PER_PAGE, tablePage * PER_PAGE);

  const anyTableFilterActive = !!tableSearch || tableActiveTab !== "all" || !!tableDateFrom || !!tableDateTo;

  const clearTableFilters = () => {
    setTableSearch("");
    setTableActiveTab("all");
    setTableDateFrom(""); setTableDateTo("");
    setTablePendingFrom(""); setTablePendingTo("");
    setSelectedCutoffId("all");
    setTablePage(1);
  };

  function toggleTableSort(key) {
    if (tableSortKey === key) setTableSortDir(d => d * -1);
    else { setTableSortKey(key); setTableSortDir(-1); }
    setTablePage(1);
  }

  function TableSortIcon({ col }) {
    if (tableSortKey !== col) return <ArrowUpDown size={11} style={{ marginLeft: 2, opacity: 0.4 }} />;
    return tableSortDir === 1
      ? <ChevronUp   size={11} style={{ marginLeft: 2, color: "#f97316" }} />
      : <ChevronDown size={11} style={{ marginLeft: 2, color: "#f97316" }} />;
  }

  function goTablePage(p) { setTablePage(p); }

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
      setLeaveMatrix(rows.map((row) => normalizeLeaveMatrixRow(row, types)));
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
    setPreview(null);
  };

  // GET /api/leaves/:id/preview — read-only, computes the day-by-day paid/unpaid
  // split against current balance so the approver sees the real outcome before acting.
  useEffect(() => {
    if (!actionDialog.open || !actionDialog.request || !token) return;
    setPreviewLoading(true);
    fetch(`${API_URL}/api/leaves/${actionDialog.request.id}/preview`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setPreview(data.data ?? null))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [actionDialog.open, actionDialog.request, token]);

  // GET /api/leaves/:id/days — post-decision actual outcome, shown in the detail dialog
  useEffect(() => {
    const status = detailDialog.request?.status;
    if (!detailDialog.open || !detailDialog.request || !token || !["approved", "rejected"].includes(status)) {
      setDayBreakdown([]);
      return;
    }
    setDayBreakdownLoading(true);
    fetch(`${API_URL}/api/leaves/${detailDialog.request.id}/days`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setDayBreakdown(Array.isArray(data.data) ? data.data : []))
      .catch(() => setDayBreakdown([]))
      .finally(() => setDayBreakdownLoading(false));
  }, [detailDialog.open, detailDialog.request, token]);

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
        if (res.status === 409) {
          // Someone else in the eligible approver pool already acted — not an error,
          // just stale state. Refresh so the list reflects the real outcome.
          toast("Already handled", {
            description: data.message || "This leave request was already actioned by someone else.",
            icon: <AlertCircle className="h-5 w-5 text-blue-500" />,
            duration: 6000,
          });
          fetchLeaves();
          fetchLeaveMatrix();
        } else if (data.debug?.available !== undefined) {
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

  // Company-wide cutoff periods (no departmentId filter — this is an admin view across
  // every department) feed the Date Range filter's quick-select-by-pay-period dropdown.
  useEffect(() => {
    if (!token) return;
    const fetchCutoffPeriods = async () => {
      try {
        const res = await fetch(`${API_URL}/api/cutoff-periods`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await res.json();
        if (res.ok) setCutoffPeriods((j.data || []).sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart)));
      } catch { /* silent */ }
    };
    fetchCutoffPeriods();
  }, [token]);

  const handleCutoffSelect = (value) => {
    setSelectedCutoffId(value);
    if (value === "all") return;
    const period = cutoffPeriods.find((p) => periodRangeKey(p) === value);
    if (!period) return;
    const from = period.periodStart.slice(0, 10);
    const to   = period.periodEnd.slice(0, 10);
    setTablePendingFrom(from);
    setTablePendingTo(to);
    setTableDateFrom(from);
    setTableDateTo(to);
    setTablePage(1);
  };

  const goToToday = () => {
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  // Generates a PDF of exactly what the table's current filters show (date
  // range, tab, search) — not the full unfiltered company history.
  const handleGeneratePdf = async () => {
    if (tableFiltered.length === 0) {
      toast.error("No leave requests to export for the current filters.");
      return;
    }
    setGeneratingPdf(true);
    try {
      const { exportLeaveRequestsPDF } = await import("@/lib/exports/leaveRequests");
      const dateRangeLabel = tableDateFrom || tableDateTo
        ? `${tableDateFrom ? toLocalDate(tableDateFrom).toLocaleDateString() : "…"} - ${tableDateTo ? toLocalDate(tableDateTo).toLocaleDateString() : "…"}`
        : "All dates";
      // Attach each employee's current (most recent) balance for that specific
      // leave type — the matrix is already fetched for the detail panel's
      // Leave Credits section, just keyed by email here instead of one row.
      const dataWithBalances = tableFiltered.map((l) => {
        const req = l.requester || l.User;
        const email = (req?.email || "").toLowerCase();
        const bal = matrixByEmail[email]?.balances?.[l.leaveType];
        return { ...l, currentBalance: bal?.available ?? null };
      });
      const result = await exportLeaveRequestsPDF({ data: dataWithBalances, dateRangeLabel });
      if (result.success) toast.success(`Downloaded ${result.filename}`);
    } catch (e) {
      toast.error(e.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Request detail content — shared by the table-view side panel and the
  // calendar-view modal, so the two surfaces can't drift out of sync ─────────
  const renderLeaveDetailContent = (request) => {
    const req = request.requester || request.User;
    const fullName = req?.name || [req?.profile?.firstName, req?.profile?.lastName].filter(Boolean).join(" ") || [req?.firstName, req?.lastName].filter(Boolean).join(" ");
    const primary = request.approver;
    const secondary = request.secondApprover;
    const email = (request.requester?.email || request.User?.email || "").toLowerCase();
    const creditsRow = matrixByEmail[email];
    const days = Math.floor((toLocalDate(request.endDate) - toLocalDate(request.startDate)) / 86400000) + 1;
    const finalComment = request.escalatedBy ? request.secondaryApproverComments : request.approverComments;
    const isApproved = request.status === "approved";
    const isDecided = ["approved", "rejected"].includes(request.status);
    const fmtDate = (d) => toLocalDate(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    return (
      <div>
        <div className="text-base font-bold">{request.leaveType}</div>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <StatusBadge status={request.status} />
          {(() => {
            const outcome = resolveLeavePayOutcome(request);
            if (!outcome) return null;
            const className = {
              paid:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0",
              unpaid:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0",
              partial: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0",
            }[outcome];
            const label = { paid: "Paid Leave", unpaid: "Unpaid Leave", partial: "Partially Paid" }[outcome];
            return <Badge variant="secondary" className={className}>{label}</Badge>;
          })()}
        </div>

        <DetailSectionLabel>Leave Period</DetailSectionLabel>
        <DetailRow label="From" value={fmtDate(request.startDate)} />
        <DetailRow label="To" value={fmtDate(request.endDate)} />
        <DetailRow label="Duration" value={`${days} day${days === 1 ? "" : "s"}`} valueClassName="text-orange-600 font-semibold" />

        <DetailSectionLabel>Employee Information</DetailSectionLabel>
        {fullName && <DetailRow label="Name" value={fullName} />}
        <DetailRow label="Email" value={request.requester?.email || request.User?.email || "Unknown"} />
        <DetailRow label="Department" value={request.requester?.department?.name || request.User?.department?.name || "Not specified"} />

        {(primary || secondary) && (
          <>
            <DetailSectionLabel>Assigned Approver</DetailSectionLabel>
            {primary && (
              <>
                <DetailRow label="Name" value={primary.name || primary.email || "—"} />
                {primary.email && <DetailRow label="Email" value={primary.email} />}
              </>
            )}
            {secondary && <DetailRow label="Secondary" value={secondary.name || secondary.email || "—"} />}
          </>
        )}

        {/* Any eligible admin/dept supervisor can act, not just the assigned
            approver above — these two show who actually escalated/decided. */}
        {request.escalatedBy && (
          <>
            <DetailSectionLabel>Escalated By</DetailSectionLabel>
            <DetailRow label="Name" value={request.escalatedBy.name || request.escalatedBy.email || "—"} />
          </>
        )}

        {isDecided && (
          <>
            <DetailSectionLabel>Decided By</DetailSectionLabel>
            <DetailRow label="Name" value={request.decidedBy?.name || request.decidedBy?.email || "Not recorded"} />
          </>
        )}

        {(creditsRow || matrixLoading) && (
          <>
            <DetailSectionLabel>Leave Credits</DetailSectionLabel>
            {creditsRow ? (() => {
              const bal = creditsRow.balances?.[request.leaveType] || { credits: 0, used: 0, available: 0 };
              return (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{request.leaveType}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{bal.credits}h total</span>
                    <span className="text-amber-600">{bal.used}h used</span>
                    <span className={`font-bold ${bal.available > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {bal.available}h left
                    </span>
                  </div>
                </div>
              );
            })() : (
              <p className="text-xs text-muted-foreground">Loading credits...</p>
            )}
          </>
        )}

        {/* Actual day-by-day outcome — GET /:id/days, only meaningful once a decision has been made */}
        {isDecided && (dayBreakdownLoading || dayBreakdown.length > 0) && (
          <>
            <DetailSectionLabel>Actual Day-by-Day Outcome</DetailSectionLabel>
            {dayBreakdownLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden bg-white dark:bg-neutral-900">
                <div className="max-h-40 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                  {dayBreakdown.map((d) => (
                    <div key={d.date} className="flex items-center justify-between px-3 py-1.5 text-xs">
                      <span>{toLocalDate(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{d.hours}h</span>
                        <Badge variant="outline" className={d.isPaid ? "text-green-700 border-green-300 bg-green-50" : "text-amber-700 border-amber-300 bg-amber-50"}>
                          {d.isPaid ? "Paid" : "Unpaid"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <DetailSectionLabel>Request Info</DetailSectionLabel>
        <DetailRow label="Submitted" value={`${new Date(request.createdAt).toLocaleDateString()} ${new Date(request.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} />
        {request.leaveReason && (
          <div className="mt-1.5">
            <span className="text-xs text-muted-foreground">Reason</span>
            <div className="bg-muted p-2 rounded-md text-xs mt-1">{request.leaveReason}</div>
          </div>
        )}

        {/* approverComments holds either the direct decision's comment, or (if
            escalated) the first reviewer's escalation note — secondaryApproverComments
            only exists when a second reviewer made the final call. */}
        {request.escalatedBy && request.approverComments && (
          <div className="mt-3">
            <span className="text-xs text-muted-foreground">Escalation Note</span>
            <div className="p-2 rounded-md text-xs border bg-muted/40 border-border mt-1">
              {request.approverComments}
            </div>
          </div>
        )}

        {finalComment && isDecided && (
          <div className="mt-3">
            <span className="text-xs text-muted-foreground">{isApproved ? "Approval" : "Rejection"} Comment</span>
            <div className={`p-2 rounded-md text-xs border mt-1 ${
              isApproved
                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
            }`}>
              {finalComment}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">Request ID</span>
          <span className="font-mono text-xs">{request.id}</span>
        </div>
      </div>
    );
  };

  // Approve/Reject actions — only rendered when the request is actionable by
  // the current viewer (canAct, per _isEligibleApprover on the server).
  const renderLeaveDetailActions = (request) => (
    (request?.status === "pending" || request?.status === "pending_secondary") && request?.canAct === true ? (
      <>
        <Button
          variant="outline"
          onClick={() => { setDetailDialog({ open: false, request: null }); setActionDialog({ open: true, type: "reject", request }); }}
          className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          <XCircle className="mr-2 h-4 w-4" /> Reject
        </Button>
        <Button
          onClick={() => { setDetailDialog({ open: false, request: null }); setActionDialog({ open: true, type: "approve", request }); }}
          className="bg-green-500 hover:bg-green-600 text-white"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
        </Button>
      </>
    ) : null
  );

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
              onClick={() => { setViewMode("table"); setDetailDialog({ open: false, request: null }); }}
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
              onClick={() => { setViewMode("calendar"); setDetailDialog({ open: false, request: null }); }}
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
          <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
              <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
                <Calendar size={15} color="#f97316" />
                Employee Leave Requests
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#888" }}>{tablePaginated.length} of {tableFiltered.length}</span>
                <button
                  onClick={handleGeneratePdf}
                  disabled={generatingPdf}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "#f97316", background: "#fff7f0", border: "0.5px solid #f97316", borderRadius: 8, padding: "5px 10px", cursor: generatingPdf ? "default" : "pointer", opacity: generatingPdf ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  {generatingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {generatingPdf ? "Generating…" : "Generate PDF"}
                </button>
              </div>
            </div>

            {/* Search + Date Range */}
            <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", background: "#fff", maxWidth: 320, flex: "1 1 260px" }}>
                <Search size={13} color="#bbb" />
                <input
                  value={tableSearch}
                  onChange={e => { setTableSearch(e.target.value); setTablePage(1); }}
                  placeholder="Search by name, leave type, or status…"
                  style={{ border: "none", outline: "none", fontSize: 12, color: "#1a1a1a", background: "transparent", width: "100%" }}
                />
                {tableSearch && (
                  <button onClick={() => { setTableSearch(""); setTablePage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", display: "flex", alignItems: "center", padding: 0 }}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <CutoffDateRangeFilter
                mode="picker"
                cutoffPeriods={cutoffPeriods}
                selectedCutoffId={selectedCutoffId}
                onSelectCutoff={handleCutoffSelect}
                size="compact"
              />
              <CutoffDateRangeFilter
                mode="range"
                from={tablePendingFrom}
                to={tablePendingTo}
                onFromChange={(v) => { setTablePendingFrom(v); setSelectedCutoffId("all"); }}
                onToChange={(v) => { setTablePendingTo(v); setSelectedCutoffId("all"); }}
                onApply={() => { setTableDateFrom(tablePendingFrom); setTableDateTo(tablePendingTo); setTablePage(1); }}
                isDirty={tablePendingFrom !== tableDateFrom || tablePendingTo !== tableDateTo}
                size="compact"
              />
              {anyTableFilterActive && (
                <button
                  onClick={clearTableFilters}
                  style={{ display: "flex", alignItems: "center", gap: 4, height: 32, border: "0.5px solid #f97316", borderRadius: 8, padding: "0 10px", background: "#fff7f0", color: "#f97316", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", padding: "0 16px", borderBottom: "0.5px solid #e5e5e5", overflowX: "auto" }}>
              {statusTabs.map(t => {
                const active = tableActiveTab === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => { setTableActiveTab(t.value); setTablePage(1); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 10px", fontSize: 12, fontWeight: 500, cursor: "pointer", color: active ? "#f97316" : "#888", background: "none", border: "none", borderBottom: active ? "2px solid #f97316" : "2px solid transparent", whiteSpace: "nowrap", marginBottom: -0.5, fontFamily: "inherit" }}
                  >
                    {t.label}
                    <span style={{ fontSize: 11, borderRadius: 20, padding: "1px 6px", fontWeight: 400, background: active ? "#faeeda" : "#f5f5f3", color: active ? "#633806" : "#888" }}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex">
            {/* Table */}
            <div style={{ overflowX: "auto", flex: 1, minWidth: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      { label: "Name",        key: null,         w: "auto", align: "left"  },
                      { label: "Date Range",  key: "startDate",  w: "1%",   align: "left"  },
                      { label: "Leave Type",  key: "leaveType",  w: "auto", align: "left"  },
                      { label: "Pay Type",    key: null,         w: "1%",   align: "left"  },
                      { label: "Submitted",   key: "createdAt",  w: "1%",   align: "right" },
                    ].map((col, i) => (
                      <th
                        key={i}
                        onClick={() => col.key && toggleTableSort(col.key)}
                        style={{ width: col.w, fontSize: 11, fontWeight: 500, color: "#888", textAlign: col.align, padding: "8px 12px", borderBottom: "0.5px solid #e5e5e5", background: "#fafaf9", whiteSpace: "nowrap", cursor: col.key ? "pointer" : "default", userSelect: "none" }}
                      >
                        {col.label}{col.key && <TableSortIcon col={col.key} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "48px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <Loader2 size={24} className="animate-spin" style={{ color: "#f97316" }} />
                        </div>
                      </td>
                    </tr>
                  ) : tablePaginated.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px", gap: 8 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Search size={16} color="#bbb" />
                          </div>
                          <div style={{ fontSize: 13, color: "#888" }}>No records found</div>
                        </div>
                      </td>
                    </tr>
                  ) : tablePaginated.map(row => {
                    const req      = row.requester || row.User;
                    const name     = req?.name || [req?.profile?.firstName, req?.profile?.lastName].filter(Boolean).join(" ") || [req?.firstName, req?.lastName].filter(Boolean).join(" ") || req?.email || "Unknown";
                    const sCfg     = statusConfig[row.status];
                    const SIcon    = sCfg?.icon ?? Clock;
                    const sPillBg  = row.status === "approved" ? "#eaf3de" : row.status === "rejected" ? "#fcebeb" : row.status === "pending_secondary" ? "#EEEDFE" : row.status === "cancelled" ? "#f5f5f3" : "#faeeda";
                    const sPillClr = row.status === "approved" ? "#3b6d11" : row.status === "rejected" ? "#791f1f" : row.status === "pending_secondary" ? "#3C3489" : row.status === "cancelled" ? "#888" : "#633806";
                    const isSelected = detailDialog.request?.id === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setDetailDialog({ open: true, request: row })}
                        style={{ borderBottom: "0.5px solid #e5e5e5", cursor: "pointer", background: isSelected ? "#fff7f0" : undefined, borderLeft: isSelected ? "2px solid #f97316" : "2px solid transparent" }}
                      >
                        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <User size={13} color="#888" />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
                              {sCfg && (
                                <span style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3, background: sPillBg, color: sPillClr, padding: "2px 7px", borderRadius: 20, fontWeight: 500 }}>
                                  <SIcon size={10} />
                                  {sCfg.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                          {row.startDate ? (() => {
                            const s    = toLocalDate(row.startDate);
                            const e    = toLocalDate(row.endDate);
                            const days = Math.floor((e - s) / 86400000) + 1;
                            const fmt  = d => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                            return (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>{fmt(s)} – {fmt(e)}</div>
                                <div style={{ fontSize: 11, color: "#f97316", marginTop: 2 }}>{days} day{days === 1 ? "" : "s"}</div>
                              </div>
                            );
                          })() : <span style={{ fontSize: 12, color: "#bbb" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Calendar size={12} color="#f97316" />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{row.leaveType}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                          {(() => {
                            const outcome = resolveLeavePayOutcome(row);
                            if (!outcome) return null;
                            if (outcome === "partial") return <span style={{ background: "#f3e8ff", color: "#7c3aed", padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>Partially Paid</span>;
                            if (outcome === "paid") return <span style={{ background: "#eaf3de", color: "#3b6d11", padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>Paid Leave</span>;
                            return <span style={{ background: "#f5f5f3", color: "#888", padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, border: "0.5px solid #d0d0d0" }}>Unpaid Leave</span>;
                          })()}
                        </td>
                        <td style={{ padding: "10px 12px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 12, color: "#888" }}>
                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Request details side panel — mirrors the employee-side LeaveLogs.jsx
                pattern: select a row, inspect/act in a panel, explicit dismiss. */}
            {detailDialog.open && detailDialog.request && (
              <div className="w-[300px] min-w-[300px] border-l border-border flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="font-medium text-sm">Request details</span>
                  <button
                    onClick={() => setDetailDialog({ open: false, request: null })}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                  {renderLeaveDetailContent(detailDialog.request)}
                </div>
                {renderLeaveDetailActions(detailDialog.request) && (
                  <div className="border-t border-border p-3 flex gap-2">
                    {renderLeaveDetailActions(detailDialog.request)}
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "0.5px solid #e5e5e5", background: "#fafaf9", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <button disabled={tablePage === 1} onClick={() => goTablePage(1)} style={{ border: "0.5px solid #e5e5e5", background: "#fff", color: "#888", borderRadius: 8, padding: "4px 9px", fontSize: 12, cursor: tablePage === 1 ? "default" : "pointer", display: "flex", alignItems: "center", gap: 3, opacity: tablePage === 1 ? 0.4 : 1, fontFamily: "inherit" }}>
                  <ChevronsLeft size={12} /> First
                </button>
                {Array.from({ length: tableTotalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => goTablePage(p)} style={{ border: `0.5px solid ${tablePage === p ? "#f97316" : "#e5e5e5"}`, background: tablePage === p ? "#f97316" : "#fff", color: tablePage === p ? "#fff" : "#888", borderRadius: 8, padding: "4px 9px", fontSize: 12, cursor: "pointer", fontWeight: tablePage === p ? 500 : 400, fontFamily: "inherit" }}>
                    {p}
                  </button>
                ))}
                <button disabled={tablePage === tableTotalPages} onClick={() => goTablePage(tableTotalPages)} style={{ border: "0.5px solid #e5e5e5", background: "#fff", color: "#888", borderRadius: 8, padding: "4px 9px", fontSize: 12, cursor: tablePage === tableTotalPages ? "default" : "pointer", display: "flex", alignItems: "center", gap: 3, opacity: tablePage === tableTotalPages ? 0.4 : 1, fontFamily: "inherit" }}>
                  Last <ChevronsRight size={12} />
                </button>
              </div>
              <span style={{ fontSize: 12, color: "#888" }}>
                Page {tablePage} of {tableTotalPages} · {tableFiltered.length} records
              </span>
            </div>
          </div>
        )}

        {/* ── Calendar View ── */}
        {viewMode === "calendar" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Calendar grid */}
            <Card className="lg:col-span-2">
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

            {/* Selected date detail panel — swaps to the full leave detail in-place
                when a leave is selected, instead of a modal (matches the table
                view's inline-panel treatment; no separate column needed here since
                this card already occupies the same space). */}
            <Card className="lg:col-span-1 lg:sticky lg:top-6">
              <CardHeader className="pb-3 border-b">
                {detailDialog.open && detailDialog.request ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetailDialog({ open: false, request: null })}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded flex-shrink-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <CardTitle className="text-sm font-semibold">Request Details</CardTitle>
                  </div>
                ) : (
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
                )}
              </CardHeader>

              <CardContent className={detailDialog.open && detailDialog.request ? "p-4" : "p-0"}>
                {detailDialog.open && detailDialog.request ? (
                  <>
                    {renderLeaveDetailContent(detailDialog.request)}
                    {renderLeaveDetailActions(detailDialog.request) && (
                      <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                        {renderLeaveDetailActions(detailDialog.request)}
                      </div>
                    )}
                  </>
                ) : selectedDateLeaves.length === 0 ? (
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
                      const req   = leave.requester || leave.User;
                      const email = req?.email || "Unknown";
                      const name  = req?.name || [req?.profile?.firstName, req?.profile?.lastName].filter(Boolean).join(" ") || [req?.firstName, req?.lastName].filter(Boolean).join(" ") || email;
                      const dept  = req?.department?.name;
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
                                <p className="text-sm font-medium truncate">{name}</p>
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
              {actionDialog.request?.status === "pending_secondary" && (
                <DialogDescription className="text-amber-600 dark:text-amber-400 font-medium">
                  This is the second and final approval for this request.
                </DialogDescription>
              )}
            </DialogHeader>

            {actionDialog.request && (() => {
              const s = toLocalDate(actionDialog.request.startDate);
              const e = toLocalDate(actionDialog.request.endDate);
              const d = Math.floor((e - s) / 86400000) + 1;
              return (
                <div>
                  <DetailSectionLabel>Employee</DetailSectionLabel>
                  <DetailRow label="Name" value={actionDialog.request.requester?.name || actionDialog.request.User?.name || actionDialog.request.requester?.email || actionDialog.request.User?.email || "Unknown"} />
                  <DetailRow label="Leave Type" value={actionDialog.request.leaveType} />

                  {actionDialog.request.escalatedBy && (
                    <>
                      <DetailSectionLabel>Escalated By</DetailSectionLabel>
                      <DetailRow label="Name" value={actionDialog.request.escalatedBy.name || actionDialog.request.escalatedBy.email || "—"} />
                    </>
                  )}

                  <DetailSectionLabel>Leave Period</DetailSectionLabel>
                  <DetailRow label="From" value={s.toLocaleDateString()} />
                  <DetailRow label="To" value={e.toLocaleDateString()} />
                  <DetailRow label="Duration" value={`${d} day${d === 1 ? "" : "s"}`} valueClassName="text-orange-600 font-semibold" />
                  <DetailRow label="Total Hours" value={`${actionDialog.request.requestedHours ?? (d * 8)}h`} valueClassName="text-orange-600 font-semibold" />
                </div>
              );
            })()}

            {/* Paid/unpaid breakdown — GET /:id/preview, the real outcome if approved now */}
            {actionDialog.request && (
              previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing paid/unpaid breakdown…
                </div>
              ) : !preview ? null : preview.isPaid === false ? (
                <div>
                  <DetailSectionLabel>Pay Outcome</DetailSectionLabel>
                  <p className="text-xs text-muted-foreground">Unpaid by the employee's choice — no balance will be checked or deducted.</p>
                </div>
              ) : (
                <div>
                  <DetailSectionLabel>{actionDialog.request.leaveType} Balance</DetailSectionLabel>
                  <DetailRow label="Available" value={`${preview.availableBalance ?? 0}h`} />
                  <DetailRow label="Will Be Paid" value={`${preview.paidHours ?? 0}h`} valueClassName="text-green-600" />
                  <DetailRow label="Auto-Unpaid" value={`${preview.unpaidHours ?? 0}h`} valueClassName={preview.unpaidHours > 0 ? "text-amber-600" : ""} />
                  {preview.unpaidHours > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-medium mt-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      Balance runs out partway through — {preview.unpaidHours}h of this request will fall back to unpaid.
                    </div>
                  )}
                  {Array.isArray(preview.days) && preview.days.length > 0 && (
                    <div className="border rounded-md overflow-hidden bg-white dark:bg-neutral-900 mt-2">
                      <div className="max-h-40 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                        {preview.days.map((d) => (
                          <div key={d.date} className="flex items-center justify-between px-3 py-1.5 text-xs">
                            <span>{toLocalDate(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{d.hours}h</span>
                              <Badge variant="outline" className={d.isPaid ? "text-green-700 border-green-300 bg-green-50" : "text-amber-700 border-amber-300 bg-amber-50"}>
                                {d.isPaid ? "Paid" : "Unpaid"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Comments <span className="text-muted-foreground">(optional)</span></label>
              <Textarea
                placeholder={`Add a comment for this ${actionDialog.type}...`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Escalation is only valid from the first stage — the server's escalate
                branch requires status === "pending". A request already at
                "pending_secondary" has already been escalated once; offering it
                again here would be a dead option the server silently ignores. */}
            {actionDialog.type === "approve" && multiApprovalEnabled && actionDialog.request?.status === "pending" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requireSecondApproval"
                    checked={requireSecondApproval}
                    onCheckedChange={(v) => { setRequireSecondApproval(!!v); if (!v) setEscalateTo(""); }}
                  />
                  <label htmlFor="requireSecondApproval" className="text-sm font-medium cursor-pointer">
                    Require second approval
                  </label>
                </div>
                {requireSecondApproval && (
                  <Select value={escalateTo} onValueChange={setEscalateTo}>
                    <SelectTrigger>
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
