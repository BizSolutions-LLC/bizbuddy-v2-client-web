// Employee Leave Requests — inline table + side panel
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Calendar,
  CalendarPlus,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  XCircle,
  FileText,
  TrendingUp,
  Clock,
  User,
  Plus,
  Send,
  Loader2,
  AlertCircle,
  Briefcase,
  Heart,
  Umbrella,
  Baby,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import socketService from "@/lib/socketService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CutoffDateRangeFilter, { periodRangeKey } from "@/components/common/CutoffDateRangeFilter";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const toLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

const fmtDate = (dateStr) =>
  toLocalDate(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const fmtSubmitted = (isoStr) =>
  new Date(isoStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const fmtShiftTime = (t) => {
  if (!t) return "—";
  try {
    return new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return t;
  }
};

const daysBetween = (s, e) =>
  Math.floor((toLocalDate(e) - toLocalDate(s)) / 864e5) + 1;

const STATUS_CFG = {
  pending:           { bg: "#faeeda", color: "#633806", label: "Pending",       Icon: Clock },
  pending_secondary: { bg: "#EEEDFE", color: "#3C3489", label: "Pending final", Icon: Clock },
  approved:          { bg: "#eaf3de", color: "#3b6d11", label: "Approved",      Icon: CheckCircle2 },
  rejected:          { bg: "#fcebeb", color: "#791f1f", label: "Rejected",      Icon: XCircle },
  cancelled:         { bg: "#f5f5f3", color: "#888",    label: "Cancelled",     Icon: XCircle },
};

const LEAVE_ICONS = {
  "Sick Leave":      Heart,
  "Personal Leave":  User,
  "Vacation Leave":  Umbrella,
  "Maternity Leave": Baby,
  "Paternity Leave": Baby,
  "Emergency Leave": AlertCircle,
};

function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

function PayPill({ isPaid }) {
  if (isPaid === undefined || isPaid === null) return null;
  return isPaid ? (
    <span style={{ background: "#eaf3de", color: "#3b6d11", padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>Paid Leave</span>
  ) : (
    <span style={{ background: "#f5f5f3", color: "#888", padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, border: "0.5px solid #d0d0d0" }}>Unpaid Leave</span>
  );
}

const BOX     = { background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 12 };
const SEC_LBL = { fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "#bbb", marginBottom: 8, marginTop: 14 };
const FIELD_LABEL = { fontSize: 11, fontWeight: 500, color: "#888", display: "flex", alignItems: "center", gap: 4 };
const INPUT_BASE  = { width: "100%", fontSize: 12, fontFamily: "inherit", borderRadius: 8, background: "#fff", color: "#1a1a1a", padding: "0 10px", height: 34 };
const PER_PAGE = 10;

export default function EmployeeLeaveRequests() {
  const { token } = useAuthStore();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [leaves,  setLeaves]  = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Table UI ──────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [activeTab,   setActiveTab]   = useState("all");
  const [sortKey,     setSortKey]     = useState("createdAt");
  const [sortDir,     setSortDir]     = useState(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);

  // ── Date range filter ─────────────────────────────────────────────────────
  const [cutoffPeriods,    setCutoffPeriods]    = useState([]);
  const [selectedCutoffId, setSelectedCutoffId] = useState("all");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo,   setPendingTo]   = useState("");

  // Actual day-by-day paid/unpaid outcome — GET /:id/days, only meaningful once decided
  const [dayBreakdown,        setDayBreakdown]        = useState([]);
  const [dayBreakdownLoading, setDayBreakdownLoading] = useState(false);

  // ── Form modal ────────────────────────────────────────────────────────────
  const [modalOpen,        setModalOpen]        = useState(false);
  const [policies,         setPolicies]         = useState([]);
  const [loadingPolicies,  setLoadingPolicies]  = useState(false);
  const [leaveType,        setLeaveType]        = useState("");
  const [approverId,       setApproverId]       = useState("");
  const [reason,           setReason]           = useState("");
  const [startDate,        setStartDate]        = useState("");
  const [startTime,        setStartTime]        = useState("08:00");
  const [endDate,          setEndDate]          = useState("");
  const [endTime,          setEndTime]          = useState("17:00");
  const [approvers,        setApprovers]        = useState([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [affectedSchedules,   setAffectedSchedules]   = useState([]);
  const [loadingSchedules,    setLoadingSchedules]     = useState(false);
  const [errors,           setErrors]           = useState({});
  const [submitting,       setSubmitting]       = useState(false);
  const scheduleTimerRef = useRef(null);

  // ── Derived / computed ────────────────────────────────────────────────────
  const selectedPolicy = useMemo(
    () => policies.find(p => p.leaveType === leaveType) ?? null,
    [leaveType, policies]
  );
  // "paid" | "unpaid" — the employee's free choice, only meaningful when the
  // policy permits both (see docs/CLIENT_LEAVE_CONTRACT.md Phase 2 §2).
  const [payMode, setPayMode] = useState("paid");
  useEffect(() => { setPayMode("paid"); }, [leaveType]);

  const policyAllowsPaid   = selectedPolicy ? selectedPolicy.isPaid !== false   : true;
  const policyAllowsUnpaid = selectedPolicy ? selectedPolicy.isNotPaid !== false : false;
  const bothPayModesAllowed = policyAllowsPaid && policyAllowsUnpaid;
  const resolvedIsPaid = !selectedPolicy
    ? true
    : bothPayModesAllowed
      ? payMode === "paid"
      : policyAllowsPaid;

  const duration = useMemo(() => {
    if (!startDate || !endDate) return null;
    const d = Math.round((new Date(endDate) - new Date(startDate)) / 864e5) + 1;
    return d > 0 ? d : null;
  }, [startDate, endDate]);

  const duplicateConflict = useMemo(() => {
    if (!startDate || !endDate) return null;
    const newStart = new Date(startDate);
    const newEnd   = new Date(endDate);
    return leaves.find(r => {
      if (!["pending", "pending_secondary", "approved"].includes(r.status)) return false;
      const s = new Date(r.startDate.slice(0, 10));
      const e = new Date(r.endDate.slice(0, 10));
      return newStart <= e && s <= newEnd;
    }) ?? null;
  }, [startDate, endDate, leaves]);

  const affectedShiftIds = useMemo(
    () => affectedSchedules.map(s => s.userShiftId),
    [affectedSchedules]
  );

  const totalAffectedHours = useMemo(
    () => affectedSchedules.reduce((sum, s) => sum + (Number(s.scheduledHours) || 0), 0),
    [affectedSchedules]
  );

  // Date range filter, by leave period (startDate–endDate) — a request overlaps the
  // selected range if its period intersects it at all, so a leave spanning across a
  // cutoff boundary still shows up. Stats and status tabs derive from this filtered
  // set (not the raw `leaves`) so the numbers stay consistent with whatever the table
  // is actually showing.
  const dateFilteredLeaves = useMemo(() => {
    if (!dateFrom && !dateTo) return leaves;
    return leaves.filter((r) => {
      if (!r.startDate || !r.endDate) return false;
      const s = r.startDate.slice(0, 10);
      const e = r.endDate.slice(0, 10);
      return (!dateTo || s <= dateTo) && (!dateFrom || e >= dateFrom);
    });
  }, [leaves, dateFrom, dateTo]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = dateFilteredLeaves.length;
    const pending    = dateFilteredLeaves.filter(r => r.status === "pending").length;
    const pendingSec = dateFilteredLeaves.filter(r => r.status === "pending_secondary").length;
    const approved   = dateFilteredLeaves.filter(r => r.status === "approved").length;
    const rejected   = dateFilteredLeaves.filter(r => r.status === "rejected").length;
    const totalDays  = dateFilteredLeaves
      .filter(r => r.status === "approved" && r.startDate && r.endDate)
      .reduce((s, r) => s + daysBetween(r.startDate, r.endDate), 0);
    return { total, pending, pendingSec, approved, rejected, totalDays };
  }, [dateFilteredLeaves]);

  const TABS = [
    { label: "All",           value: "all",               count: stats.total },
    { label: "Pending",       value: "pending",           count: stats.pending },
    { label: "Pending final", value: "pending_secondary", count: stats.pendingSec },
    { label: "Approved",      value: "approved",          count: stats.approved },
    { label: "Rejected",      value: "rejected",          count: stats.rejected },
  ];

  // ── Table processing ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = dateFilteredLeaves;
    if (activeTab !== "all") list = list.filter(r => r.status === activeTab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.leaveType   ?? "").toLowerCase().includes(q) ||
        (r.leaveReason ?? "").toLowerCase().includes(q) ||
        (r.status      ?? "").toLowerCase().includes(q) ||
        (r.approver?.name ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? "", bv = b[sortKey] ?? "";
      return av > bv ? sortDir : av < bv ? -sortDir : 0;
    });
  }, [dateFilteredLeaves, activeTab, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  useEffect(() => { setCurrentPage(1); setSelectedRow(null); }, [activeTab, search, dateFrom, dateTo]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
    setCurrentPage(1);
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <ArrowUpDown size={11} style={{ marginLeft: 2, opacity: 0.4 }} />;
    return sortDir === 1
      ? <ChevronUp   size={11} style={{ marginLeft: 2, color: "#f97316" }} />
      : <ChevronDown size={11} style={{ marginLeft: 2, color: "#f97316" }} />;
  }

  function goPage(p)      { setCurrentPage(p); setSelectedRow(null); }
  function selectRow(row) { setSelectedRow(prev => prev?.id === row.id ? null : row); }

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchLeaves = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/leaves/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to fetch leave requests");
      setLeaves(data.data ?? []);
    } catch (e) {
      toast.error(e.message ?? "Failed to fetch leave requests");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Company-wide cutoff periods feed the Date Range filter's quick-select-by-pay-period dropdown.
  const fetchCutoffPeriods = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/cutoff-periods`, { headers: { Authorization: `Bearer ${token}` } });
      const j   = await res.json();
      if (res.ok) setCutoffPeriods((j.data || []).sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart)));
    } catch { /* silent */ }
  }, [token]);

  const handleCutoffSelect = (value) => {
    setSelectedCutoffId(value);
    if (value === "all") return;
    const period = cutoffPeriods.find((p) => periodRangeKey(p) === value);
    if (!period) return;
    const from = period.periodStart.slice(0, 10);
    const to   = period.periodEnd.slice(0, 10);
    setPendingFrom(from);
    setPendingTo(to);
    setDateFrom(from);
    setDateTo(to);
  };

  const anyDateFilterActive = !!dateFrom || !!dateTo;

  const clearDateFilters = () => {
    setSelectedCutoffId("all");
    setDateFrom(""); setDateTo("");
    setPendingFrom(""); setPendingTo("");
  };

  // Single policies fetch — provides both form options AND balance cards
  const fetchPolicies = useCallback(async () => {
    if (!token) return;
    setLoadingPolicies(true);
    try {
      const res  = await fetch(`${API_URL}/api/leaves/policies`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to fetch policies");
      setPolicies(Array.isArray(data.data) ? data.data : []);
    } catch {
      toast.error("Failed to load leave policies");
    } finally {
      setLoadingPolicies(false);
    }
  }, [token]);

  // Load approvers when modal opens; policies are already loaded from mount
  useEffect(() => {
    if (!token || !modalOpen) return;
    const load = async () => {
      setLoadingApprovers(true);
      try {
        const res  = await fetch(`${API_URL}/api/leaves/approvers`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
          setApprovers(
            (Array.isArray(data.data) ? data.data : []).map(a => ({
              ...a,
              label: a.email ?? a.username ?? `User ${a.id}`,
            }))
          );
        } else {
          toast.error("Failed to load approvers");
        }
      } catch {
        toast.error("Failed to load approvers");
      } finally {
        setLoadingApprovers(false);
      }
    };
    // Re-fetch policies for fresh balanceHours when modal opens
    fetchPolicies();
    load();
  }, [token, modalOpen, fetchPolicies]);

  // Fetch affected schedules when both dates are valid (debounced 500ms)
  useEffect(() => {
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);

    if (!token || !startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      setAffectedSchedules([]);
      setLoadingSchedules(false);
      return;
    }

    setLoadingSchedules(true);
    scheduleTimerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `${API_URL}/api/leaves/affected-schedules?startDate=${startDate}&endDate=${endDate}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setAffectedSchedules(Array.isArray(data.data) ? data.data : []);
      } catch {
        setAffectedSchedules([]);
      } finally {
        setLoadingSchedules(false);
      }
    }, 500);

    return () => { if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current); };
  }, [token, startDate, endDate]);

  useEffect(() => { fetchLeaves(); fetchPolicies(); fetchCutoffPeriods(); }, [fetchLeaves, fetchPolicies, fetchCutoffPeriods]);

  // Fetch actual paid/unpaid day breakdown when a decided request is selected
  useEffect(() => {
    if (!token || !selectedRow || !["approved", "rejected"].includes(selectedRow.status)) {
      setDayBreakdown([]);
      return;
    }
    setDayBreakdownLoading(true);
    fetch(`${API_URL}/api/leaves/${selectedRow.id}/days`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setDayBreakdown(Array.isArray(data.data) ? data.data : []))
      .catch(() => setDayBreakdown([]))
      .finally(() => setDayBreakdownLoading(false));
  }, [token, selectedRow]);

  useEffect(() => {
    const h = () => fetchPolicies();
    socketService.on("leaveBalanceUpdated", h);
    return () => socketService.off("leaveBalanceUpdated", h);
  }, [fetchPolicies]);

  function resetForm() {
    setLeaveType(""); setApproverId(""); setReason(""); setPayMode("paid");
    setStartDate(""); setStartTime("08:00");
    setEndDate("");   setEndTime("17:00");
    setAffectedSchedules([]); setLoadingSchedules(false);
    setErrors({});
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
  }

  async function handleSubmit() {
    const errs = {};
    if (!leaveType)  errs.leaveType  = "Leave type is required";
    if (!approverId) errs.approverId = "Approver is required";
    if (!startDate)  errs.startDate  = "Start date is required";
    if (!endDate)    errs.endDate    = "End date is required";
    if (startDate && endDate && new Date(startDate) > new Date(endDate))
      errs.endDate = "End date must be after start date";
    if (!reason || reason.trim().length < 30)
      errs.reason = `Reason is required and must be at least 30 characters (${reason.trim().length}/30)`;
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Duplicate check — block if an active request overlaps the chosen date range
    const newStart = new Date(startDate);
    const newEnd   = new Date(endDate);
    const conflict = leaves.find(r => {
      if (!["pending", "pending_secondary", "approved"].includes(r.status)) return false;
      const s = new Date(r.startDate.slice(0, 10));
      const e = new Date(r.endDate.slice(0, 10));
      return newStart <= e && s <= newEnd;
    });
    if (conflict) {
      const s = toLocalDate(conflict.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const e = toLocalDate(conflict.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      toast.error(`You already have a ${conflict.status === "approved" ? "approved" : "pending"} leave request for ${s} – ${e}. Please choose a different date range.`);
      return;
    }

    const fromDate = startDate;
    const toDate   = endDate;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/leaves/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: leaveType,
          approverId,
          leaveReason: reason,
          fromDate,
          toDate,
          isPaid: resolvedIsPaid,
          affectedShiftIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to submit");
      toast.success("Leave request submitted successfully!");
      setModalOpen(false); resetForm(); fetchLeaves(); fetchPolicies();
    } catch (e) {
      toast.error(e.message ?? "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>

      {/* PAGE HEADER */}
      <div style={{ ...BOX, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={20} color="#f97316" />
            Leave requests
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 3 }}>Submit and track your leave requests</div>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="h-8 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> New request
        </Button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total requests", value: stats.total,    icon: <FileText     size={13} color="#f97316" />, sub: "across date range",   valColor: undefined },
          { label: "Pending",        value: stats.pending,  icon: <Clock        size={13} color="#633806" />, sub: "awaiting review",     valColor: "#633806" },
          { label: "Approved",       value: stats.approved, icon: <CheckCircle2 size={13} color="#3b6d11" />, sub: "confirmed requests",  valColor: "#3b6d11" },
          { label: "Days taken",     value: stats.totalDays,icon: <TrendingUp   size={13} color="#3C3489" />, sub: "from approved leave", valColor: "#3C3489" },
        ].map(c => (
          <div key={c.label} style={{ ...BOX, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 5 }}>{c.icon} {c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, color: c.valColor ?? "#1a1a1a" }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* LEAVE BALANCES — driven by policies.balanceHours */}
      <div style={BOX}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 16px", borderBottom: "0.5px solid #e5e5e5", fontSize: 14, fontWeight: 500 }}>
          <Briefcase size={15} color="#f97316" />
          Leave balances
          {loadingPolicies && <Loader2 size={13} className="animate-spin" style={{ color: "#f97316", marginLeft: "auto" }} />}
        </div>
        {!loadingPolicies && policies.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "#888", fontSize: 13 }}>
            No leave balances available. Contact your HR department.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ padding: "12px 16px" }}>
            {policies.map((p, i) => {
              const Icon = LEAVE_ICONS[p.leaveType] ?? Calendar;
              return (
                <div key={i} style={{ background: "#fafaf9", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={15} color="#f97316" />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{p.leaveType}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: "#f97316", lineHeight: 1 }}>{Number(p.balanceHours) || 0}h</div>
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>available</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HISTORY TABLE */}
      <div style={BOX}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e5e5", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
            <FileText size={15} color="#f97316" />
            Leave requests history
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>{dateFilteredLeaves.length} of {leaves.length}</div>
        </div>

        {/* Date range filter */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
          <CutoffDateRangeFilter
            mode="picker"
            size="compact"
            cutoffPeriods={cutoffPeriods}
            selectedCutoffId={selectedCutoffId}
            onSelectCutoff={handleCutoffSelect}
          />
          <CutoffDateRangeFilter
            mode="range"
            size="compact"
            from={pendingFrom}
            to={pendingTo}
            onFromChange={(v) => { setPendingFrom(v); setSelectedCutoffId("all"); }}
            onToChange={(v) => { setPendingTo(v); setSelectedCutoffId("all"); }}
            onApply={() => { setDateFrom(pendingFrom); setDateTo(pendingTo); }}
            isDirty={pendingFrom !== dateFrom || pendingTo !== dateTo}
          />
          {anyDateFilterActive && (
            <button
              onClick={clearDateFilters}
              style={{ fontSize: 11, color: "#f97316", fontWeight: 500, background: "none", border: "0.5px solid #f97316", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", background: "#fff", maxWidth: 320 }}>
            <Search size={13} color="#bbb" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by leave type, reason, or status…"
              style={{ border: "none", outline: "none", fontSize: 12, color: "#1a1a1a", background: "transparent", width: "100%" }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 16px", borderBottom: "0.5px solid #e5e5e5", overflowX: "auto" }}>
          {TABS.map(t => {
            const active = activeTab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 10px", fontSize: 12, fontWeight: 500, cursor: "pointer", color: active ? "#f97316" : "#888", background: "none", border: "none", borderBottom: active ? "2px solid #f97316" : "2px solid transparent", whiteSpace: "nowrap", marginBottom: -0.5 }}
              >
                {t.label}
                <span style={{ fontSize: 11, borderRadius: 20, padding: "1px 6px", fontWeight: 400, background: active ? "#faeeda" : "#f5f5f3", color: active ? "#633806" : "#888" }}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table + Side panel */}
        <div style={{ display: "flex" }}>
          <div style={{ flex: 1, overflowX: "auto", minWidth: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    { label: "Leave type", key: "leaveType", w: "auto", align: "left"   },
                    { label: "Date range", key: "startDate", w: "auto", align: "left"   },
                    { label: "Status",     key: "status",    w: "1%",   align: "center" },
                    { label: "Submitted",  key: "createdAt", w: "1%",   align: "right"  },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      style={{ width: col.w, fontSize: 11, fontWeight: 500, color: "#888", textAlign: col.align, padding: "8px 12px", borderBottom: "0.5px solid #e5e5e5", background: "#fafaf9", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}
                    >
                      {col.label} <SortIcon col={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "48px 16px", textAlign: "center" }}>
                      <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "#f97316" }} />
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px", gap: 8 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Search size={16} color="#bbb" />
                        </div>
                        <div style={{ fontSize: 13, color: "#888" }}>No records found</div>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map(row => {
                  const Icon     = LEAVE_ICONS[row.leaveType] ?? Calendar;
                  const days     = row.startDate && row.endDate ? daysBetween(row.startDate, row.endDate) : null;
                  const selected = selectedRow?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => selectRow(row)}
                      style={{ borderBottom: "0.5px solid #e5e5e5", cursor: "pointer", background: selected ? "#fff7f0" : undefined, borderLeft: selected ? "2px solid #f97316" : "2px solid transparent" }}
                    >
                      <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#f97316" }}>
                            <Icon size={13} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{row.leaveType}</span>
                            <PayPill isPaid={row.isPaid} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        {row.startDate ? (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtDate(row.startDate)} – {fmtDate(row.endDate)}</div>
                            {days && <div style={{ fontSize: 11, color: "#f97316", marginTop: 1 }}>{days} day{days === 1 ? "" : "s"}</div>}
                          </>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: "center" }}>
                        <StatusPill status={row.status} />
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, color: "#888" }}>
                          {row.createdAt ? fmtSubmitted(row.createdAt) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SIDE PANEL */}
          {selectedRow && (
            <div style={{ width: 272, minWidth: 272, borderLeft: "0.5px solid #e5e5e5", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "0.5px solid #e5e5e5" }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>Request details</span>
                <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", display: "flex", alignItems: "center", padding: 2, borderRadius: 8 }}>
                  <X size={15} />
                </button>
              </div>
              <div style={{ padding: 14, flex: 1, overflowY: "auto" }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 5 }}>{selectedRow.leaveType}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                  <StatusPill status={selectedRow.status} />
                  <PayPill isPaid={selectedRow.isPaid} />
                </div>

                <div style={SEC_LBL}>Leave period</div>
                {[
                  ["From", selectedRow.startDate ? fmtDate(selectedRow.startDate) : "—"],
                  ["To",   selectedRow.endDate   ? fmtDate(selectedRow.endDate)   : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>Duration</span>
                  <span style={{ fontSize: 12, fontWeight: 500, textAlign: "right", color: "#f97316" }}>
                    {selectedRow.startDate && selectedRow.endDate
                      ? (() => { const d = daysBetween(selectedRow.startDate, selectedRow.endDate); return `${d} day${d === 1 ? "" : "s"}`; })()
                      : "—"}
                  </span>
                </div>

                {(dayBreakdownLoading || dayBreakdown.length > 0) && (
                  <>
                    <div style={SEC_LBL}>Actual day-by-day outcome</div>
                    {dayBreakdownLoading ? (
                      <div style={{ fontSize: 11, color: "#bbb", display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                        <Loader2 size={11} className="animate-spin" /> Loading…
                      </div>
                    ) : (
                      <div style={{ border: "0.5px solid #e5e5e5", borderRadius: 8, overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ maxHeight: 140, overflowY: "auto" }}>
                          {dayBreakdown.map((d, i) => (
                            <div key={d.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderBottom: i < dayBreakdown.length - 1 ? "0.5px solid #f0f0ee" : "none" }}>
                              <span style={{ fontSize: 11, color: "#555" }}>{fmtDate(d.date)}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 11, color: "#bbb" }}>{d.hours}h</span>
                                <span style={{
                                  fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 20,
                                  background: d.isPaid ? "#eaf3de" : "#faeeda",
                                  color:      d.isPaid ? "#3b6d11" : "#633806",
                                }}>
                                  {d.isPaid ? "Paid" : "Unpaid"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div style={SEC_LBL}>Approver</div>
                {[
                  ["Name",  selectedRow.approver?.name ?? selectedRow.approver?.email ?? "Not assigned"],
                  ["Email", selectedRow.approver?.email ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: k === "Email" ? 11 : 12, fontWeight: 500, textAlign: "right" }}>{v}</span>
                  </div>
                ))}

                <div style={SEC_LBL}>Request info</div>
                {[
                  ["Pay type",  selectedRow.isPaid ? "Paid" : "Unpaid"],
                  ["Submitted", selectedRow.createdAt ? fmtSubmitted(selectedRow.createdAt) : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#888" }}>Reason</span>
                  <div style={{ background: "#fafaf9", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#888" }}>
                    {selectedRow.leaveReason ?? "No reason provided"}
                  </div>
                </div>

                {selectedRow.approverComments && selectedRow.status === "rejected" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#791f1f" }}>Rejection comment</span>
                    <div style={{ background: "#fcebeb", border: "0.5px solid #f09595", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#791f1f" }}>
                      {selectedRow.approverComments}
                    </div>
                  </div>
                )}

                <div style={{ height: 0.5, background: "#e5e5e5", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>Request ID</span>
                  <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#888", textAlign: "right", wordBreak: "break-all" }}>
                    {selectedRow.id}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pagination footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "0.5px solid #e5e5e5", background: "#fafaf9", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <button disabled={currentPage === 1} onClick={() => goPage(1)} style={{ border: "0.5px solid #e5e5e5", background: "#fff", color: "#888", borderRadius: 8, padding: "4px 9px", fontSize: 12, cursor: currentPage === 1 ? "default" : "pointer", display: "flex", alignItems: "center", gap: 3, opacity: currentPage === 1 ? 0.4 : 1, fontFamily: "inherit" }}>
              <ChevronsLeft size={12} /> First
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => goPage(p)} style={{ border: `0.5px solid ${currentPage === p ? "#f97316" : "#e5e5e5"}`, background: currentPage === p ? "#f97316" : "#fff", color: currentPage === p ? "#fff" : "#888", borderRadius: 8, padding: "4px 9px", fontSize: 12, cursor: "pointer", fontWeight: currentPage === p ? 500 : 400, fontFamily: "inherit" }}>
                {p}
              </button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => goPage(totalPages)} style={{ border: "0.5px solid #e5e5e5", background: "#fff", color: "#888", borderRadius: 8, padding: "4px 9px", fontSize: 12, cursor: currentPage === totalPages ? "default" : "pointer", display: "flex", alignItems: "center", gap: 3, opacity: currentPage === totalPages ? 0.4 : 1, fontFamily: "inherit" }}>
              Last <ChevronsRight size={12} />
            </button>
          </div>
          <span style={{ fontSize: 12, color: "#888" }}>
            Page {currentPage} of {totalPages} · {filtered.length} records
          </span>
        </div>
      </div>

      {/* NEW REQUEST MODAL */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) { setModalOpen(false); resetForm(); } else setModalOpen(true); }}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden" style={{ borderRadius: 12, border: "0.5px solid #e5e5e5" }}>
          <VisuallyHidden><DialogTitle>New leave request</DialogTitle></VisuallyHidden>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "0.5px solid #e5e5e5", flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
              <CalendarPlus size={15} color="#f97316" />
              New leave request
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "72vh" }}>

            {/* Leave type + Approver */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* Leave type */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={FIELD_LABEL}>
                  <FileText size={12} /> Leave type <span style={{ color: "#f97316" }}>*</span>
                </div>
                <Select value={leaveType} onValueChange={v => { setLeaveType(v); setErrors(e => ({ ...e, leaveType: undefined })); }} disabled={loadingPolicies}>
                  <SelectTrigger className={`h-[34px] text-xs rounded-lg border-[0.5px] ${errors.leaveType ? "border-red-500" : "border-[#d0d0d0]"}`}>
                    <SelectValue placeholder={loadingPolicies ? "Loading…" : "Select leave type…"} />
                    {loadingPolicies && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500 ml-auto" />}
                  </SelectTrigger>
                  <SelectContent>
                    {loadingPolicies ? (
                      <div className="flex items-center justify-center py-3 gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" /> Loading…
                      </div>
                    ) : policies.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-3 text-center">No leave types available</div>
                    ) : policies.map(p => (
                      <SelectItem key={p.leaveType} value={p.leaveType} className="text-xs">{p.leaveType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.leaveType && (
                  <p style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
                    <AlertCircle size={11} />{errors.leaveType}
                  </p>
                )}
              </div>

              {/* Approver */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={FIELD_LABEL}>
                  <User size={12} /> Approver <span style={{ color: "#f97316" }}>*</span>
                </div>
                <Select value={approverId} onValueChange={v => { setApproverId(v); setErrors(e => ({ ...e, approverId: undefined })); }} disabled={loadingApprovers}>
                  <SelectTrigger className={`h-[34px] text-xs rounded-lg border-[0.5px] ${errors.approverId ? "border-red-500" : "border-[#d0d0d0]"}`}>
                    <SelectValue placeholder={loadingApprovers ? "Loading…" : "Select approver…"} />
                    {loadingApprovers && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500 ml-auto" />}
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {loadingApprovers ? (
                      <div className="flex items-center justify-center py-3 gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" /> Loading…
                      </div>
                    ) : approvers.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-3 text-center">No approvers available</div>
                    ) : approvers.map(a => {
                      const role = a.role === "superadmin" ? "Super Admin" : a.role === "admin" ? "Admin" : a.role === "supervisor" ? "Supervisor" : a.role;
                      return (
                        <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                          {a.label} <span className="text-muted-foreground">({role})</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {errors.approverId && (
                  <p style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
                    <AlertCircle size={11} />{errors.approverId}
                  </p>
                )}
              </div>
            </div>

            {/* Pay mode — toggle shown only when the policy allows both; otherwise fixed */}
            {leaveType && selectedPolicy && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {bothPayModesAllowed && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setPayMode("paid")}
                      style={{
                        flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                        border: `0.5px solid ${payMode === "paid" ? "#3b6d11" : "#d0d0d0"}`,
                        background: payMode === "paid" ? "#eaf3de" : "#fff",
                        color: payMode === "paid" ? "#3b6d11" : "#888",
                      }}
                    >
                      Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMode("unpaid")}
                      style={{
                        flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                        border: `0.5px solid ${payMode === "unpaid" ? "#633806" : "#d0d0d0"}`,
                        background: payMode === "unpaid" ? "#faeeda" : "#fff",
                        color: payMode === "unpaid" ? "#633806" : "#888",
                      }}
                    >
                      Unpaid
                    </button>
                  </div>
                )}
                {resolvedIsPaid ? (
                  <div style={{ background: "#eaf3de", border: "0.5px solid #97c459", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <CheckCircle2 size={15} color="#3b6d11" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#3b6d11" }}>Paid leave</div>
                      <div style={{ fontSize: 11, color: "#888" }}>You will be compensated for this leave period.</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#f97316", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={11} />
                        {Number(selectedPolicy.balanceHours) || 0}h available balance
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "#faeeda", border: "0.5px solid #ef9f27", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <AlertCircle size={15} color="#633806" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#633806" }}>Unpaid leave</div>
                      <div style={{ fontSize: 11, color: "#888" }}>This leave will not be compensated by your employer.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Start date + time */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={FIELD_LABEL}>
                <Calendar size={12} /> Start date <span style={{ color: "#f97316" }}>*</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setErrors(er => ({ ...er, startDate: undefined })); }}
                  style={{ ...INPUT_BASE, border: `0.5px solid ${errors.startDate ? "#ef4444" : "#d0d0d0"}` }}
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{ ...INPUT_BASE, width: 110, border: "0.5px solid #d0d0d0" }}
                />
              </div>
              {errors.startDate && (
                <p style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
                  <AlertCircle size={11} />{errors.startDate}
                </p>
              )}
            </div>

            {/* End date + time + duration */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={FIELD_LABEL}>
                <Calendar size={12} /> End date <span style={{ color: "#f97316" }}>*</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setErrors(er => ({ ...er, endDate: undefined })); }}
                  style={{ ...INPUT_BASE, border: `0.5px solid ${errors.endDate ? "#ef4444" : "#d0d0d0"}` }}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{ ...INPUT_BASE, width: 110, border: "0.5px solid #d0d0d0" }}
                />
              </div>
              {errors.endDate && (
                <p style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
                  <AlertCircle size={11} />{errors.endDate}
                </p>
              )}
              {duration && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Clock size={12} color="#bbb" />
                  <span style={{ background: "#faeeda", color: "#633806", borderRadius: 20, fontSize: 11, fontWeight: 500, padding: "2px 8px" }}>
                    {duration} day{duration === 1 ? "" : "s"}
                  </span>
                  <span style={{ fontSize: 11, color: "#bbb" }}>duration</span>
                </div>
              )}
            </div>

            {/* Duplicate request warning */}
            {duplicateConflict && (
              <div style={{ background: "#fcebeb", border: "0.5px solid #f09595", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <AlertCircle size={15} color="#791f1f" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#791f1f" }}>A request already exists for this period</div>
                  <div style={{ fontSize: 11, color: "#a33" }}>
                    You have a <strong>{duplicateConflict.status === "approved" ? "approved" : "pending"}</strong> {duplicateConflict.leaveType} request
                    from {toLocalDate(duplicateConflict.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {toLocalDate(duplicateConflict.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
                    Please choose a different date range.
                  </div>
                </div>
              </div>
            )}

            {/* Affected schedules — shown when both dates are valid */}
            {startDate && endDate && duration && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={FIELD_LABEL}>
                  <CalendarDays size={12} /> Affected schedules
                </div>
                {loadingSchedules ? (
                  <div style={{ height: 44, background: "#f5f5f3", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} className="animate-pulse" />
                ) : affectedSchedules.length === 0 ? (
                  <div style={{ border: "0.5px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 12px", fontSize: 12, color: "#888" }}>
                      <CalendarX size={15} color="#bbb" />
                      No scheduled shifts for this period.
                    </div>
                  </div>
                ) : (
                  <div style={{ border: "0.5px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
                    {/* Schedule list header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#fafaf9", borderBottom: "0.5px solid #e5e5e5" }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#888", display: "flex", alignItems: "center", gap: 5 }}>
                        <CalendarDays size={13} /> Shifts that will be on leave
                      </div>
                      <div style={{ fontSize: 11, color: "#bbb" }}>
                        {affectedSchedules.length} day{affectedSchedules.length > 1 ? "s" : ""}
                      </div>
                    </div>
                    {/* Rows */}
                    {affectedSchedules.map((s, i) => (
                      <div key={s.userShiftId ?? i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: i < affectedSchedules.length - 1 ? "0.5px solid #e5e5e5" : "none", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtDate(s.assignedDate.slice(0, 10))}</div>
                          <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{s.shiftName}</div>
                          <div style={{ fontSize: 11, color: "#bbb", marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={11} />
                            {fmtShiftTime(s.startTime)} → {fmtShiftTime(s.endTime)}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#f97316", whiteSpace: "nowrap" }}>
                          {Number(s.scheduledHours).toFixed(2)}h
                        </div>
                      </div>
                    ))}
                    {/* Footer totals */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: "#fafaf9", borderTop: "0.5px solid #e5e5e5" }}>
                      <span style={{ fontSize: 11, color: "#888" }}>Total hours affected</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#f97316" }}>{totalAffectedHours.toFixed(2)}h</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={FIELD_LABEL}>
                <FileText size={12} /> Reason <span style={{ color: "#f97316" }}>*</span>
                <span style={{ fontSize: 11, color: reason.trim().length >= 30 ? "#3b6d11" : "#bbb", fontWeight: 400, marginLeft: "auto" }}>
                  {reason.trim().length}/30 min
                </span>
              </div>
              <Textarea
                value={reason}
                onChange={e => { setReason(e.target.value); setErrors(er => ({ ...er, reason: undefined })); }}
                placeholder="Provide a reason for your leave request (at least 30 characters)…"
                className={`resize-none text-xs border-[0.5px] rounded-lg min-h-[72px] ${errors.reason ? "border-red-500" : "border-[#d0d0d0]"}`}
              />
              {errors.reason && (
                <p style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
                  <AlertCircle size={11} />{errors.reason}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderTop: "0.5px solid #e5e5e5", flexShrink: 0, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: "#bbb", display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 160 }}>
              <ShieldCheck size={13} />
              Nothing changes until your approver confirms.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                variant="outline"
                className="h-8 text-xs rounded-lg border-[0.5px] border-[#d0d0d0] px-3"
                onClick={() => { setModalOpen(false); resetForm(); }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !leaveType || !approverId || !startDate || !endDate || reason.trim().length < 30 || !!duplicateConflict}
                className="h-8 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 gap-1.5"
              >
                {submitting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Submitting…</>
                  : <><Send className="h-3.5 w-3.5" />Submit request</>}
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>
    </div>
  );
}
