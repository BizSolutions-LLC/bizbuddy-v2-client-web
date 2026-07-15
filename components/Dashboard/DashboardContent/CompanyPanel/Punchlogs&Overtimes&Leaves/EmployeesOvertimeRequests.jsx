// components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesOvertimeRequests.jsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  TrendingUp,
  User,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtMMDDYYYY_hhmma } from "@/lib/dateTimeFormatter";
import CutoffDateRangeFilter, { periodRangeKey } from "@/components/common/CutoffDateRangeFilter";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const fmtSubmitted = (isoStr) =>
  new Date(isoStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const STATUS_CFG = {
  pending:  { bg: "#faeeda", color: "#633806", label: "Pending",  Icon: Clock },
  approved: { bg: "#eaf3de", color: "#3b6d11", label: "Approved", Icon: CheckCircle2 },
  rejected: { bg: "#fcebeb", color: "#791f1f", label: "Rejected", Icon: XCircle },
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

const BOX     = { background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 12 };
const SEC_LBL = { fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "#bbb", marginBottom: 8, marginTop: 14 };
const PER_PAGE = 10;

const SORT_ACCESSORS = {
  employee:       (r) => r.requester?.email ?? "",
  requestedHours: (r) => Number(r.requestedHours) || 0,
  lateHours:      (r) => Number(r.lateHours) || 0,
  status:         (r) => r.status ?? "",
  createdAt:      (r) => r.createdAt ?? "",
};

const COLUMNS = [
  { label: "Employee",   key: "employee",       w: "auto", align: "left"   },
  { label: "OT Hours",   key: "requestedHours", w: "1%",   align: "right"  },
  { label: "Late Hours", key: "lateHours",       w: "1%",   align: "right"  },
  { label: "Status",     key: "status",          w: "1%",   align: "center" },
  { label: "Submitted",  key: "createdAt",       w: "1%",   align: "right"  },
  { label: "Reason",     key: null,              w: "auto", align: "left"   },
];

export default function EmployeesOvertimeRequests() {
  const { token, user } = useAuthStore();
  const canAct = user?.role && ["admin", "supervisor", "superadmin"].includes(user.role);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(false);

  // ── Table UI ──────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [activeTab,   setActiveTab]   = useState("all");
  const [sortKey,     setSortKey]     = useState("createdAt");
  const [sortDir,     setSortDir]     = useState(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);

  // ── Approve / reject (inline in side panel) ──────────────────────────────
  const [actionType,    setActionType]    = useState(null); // "approve" | "reject" | null
  const [comment,        setComment]      = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Date range filter ─────────────────────────────────────────────────────
  const [cutoffPeriods,    setCutoffPeriods]    = useState([]);
  const [selectedCutoffId, setSelectedCutoffId] = useState("all");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo,   setPendingTo]   = useState("");

  // Date range filter, by submission date — stats and status tabs derive from this
  // filtered set (not the raw `requests`) so the numbers stay consistent with whatever
  // the table is actually showing.
  const dateFilteredRequests = useMemo(() => {
    if (!dateFrom && !dateTo) return requests;
    return requests.filter((r) => {
      if (!r.createdAt) return false;
      const d = r.createdAt.slice(0, 10);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
  }, [requests, dateFrom, dateTo]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = dateFilteredRequests.length;
    const pending  = dateFilteredRequests.filter((r) => r.status === "pending").length;
    const approved = dateFilteredRequests.filter((r) => r.status === "approved").length;
    const rejected = dateFilteredRequests.filter((r) => r.status === "rejected").length;
    const approvedHours = dateFilteredRequests
      .filter((r) => r.status === "approved")
      .reduce((s, r) => s + (Number(r.requestedHours) || 0), 0);
    return { total, pending, approved, rejected, approvedHours: approvedHours.toFixed(1) };
  }, [dateFilteredRequests]);

  const TABS = [
    { label: "All",      value: "all",      count: stats.total },
    { label: "Pending",  value: "pending",  count: stats.pending },
    { label: "Approved", value: "approved", count: stats.approved },
    { label: "Rejected", value: "rejected", count: stats.rejected },
  ];

  // ── Table processing ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = dateFilteredRequests;
    if (activeTab !== "all") list = list.filter((r) => r.status === activeTab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.requester?.profile?.firstName ?? "").toLowerCase().includes(q) ||
        (r.requester?.profile?.lastName  ?? "").toLowerCase().includes(q) ||
        (r.requester?.email              ?? "").toLowerCase().includes(q) ||
        (r.requesterReason               ?? "").toLowerCase().includes(q)
      );
    }
    const accessor = SORT_ACCESSORS[sortKey] ?? SORT_ACCESSORS.createdAt;
    return [...list].sort((a, b) => {
      const av = accessor(a), bv = accessor(b);
      return av > bv ? sortDir : av < bv ? -sortDir : 0;
    });
  }, [dateFilteredRequests, activeTab, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  useEffect(() => { setCurrentPage(1); setSelectedRow(null); }, [activeTab, search, dateFrom, dateTo]);

  function toggleSort(key) {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => d * -1);
    else { setSortKey(key); setSortDir(-1); }
    setCurrentPage(1);
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <ArrowUpDown size={11} style={{ marginLeft: 2, opacity: 0.4 }} />;
    return sortDir === 1
      ? <ChevronUp   size={11} style={{ marginLeft: 2, color: "#f97316" }} />
      : <ChevronDown size={11} style={{ marginLeft: 2, color: "#f97316" }} />;
  }

  function goPage(p) { setCurrentPage(p); setSelectedRow(null); }
  function selectRow(row) {
    setSelectedRow((prev) => (prev?.id === row.id ? null : row));
    setActionType(null);
    setComment("");
  }
  function closePanel() {
    setSelectedRow(null);
    setActionType(null);
    setComment("");
  }

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/overtime`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch overtime requests");
      setRequests(data.data || []);
    } catch (e) {
      toast.error(e.message || "Failed to fetch overtime requests");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Company-wide cutoff periods (no departmentId filter — this is an admin view across
  // every department) feed the Date Range filter's quick-select-by-pay-period dropdown.
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

  async function handleAction(type) {
    if (!selectedRow) return;
    if (type === "reject" && !comment.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/overtime/${selectedRow.id}/${type}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ approverComments: comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Request ${type}d successfully`);
      closePanel();
      fetchRequests();
    } catch (e) {
      toast.error(e.message || `Failed to ${type} request`);
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => { fetchRequests(); fetchCutoffPeriods(); }, [fetchRequests, fetchCutoffPeriods]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>

      {/* PAGE HEADER */}
      <div style={{ ...BOX, padding: "14px 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={20} color="#f97316" />
          Employee Overtime Requests
        </div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 3 }}>Review and manage overtime requests submitted by employees</div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total Requests", value: stats.total,         icon: <FileText     size={13} color="#f97316" />, sub: "across date range",       valColor: undefined },
          { label: "Pending",        value: stats.pending,       icon: <Clock        size={13} color="#633806" />, sub: "awaiting review",         valColor: "#633806" },
          { label: "Approved",       value: stats.approved,      icon: <CheckCircle2 size={13} color="#3b6d11" />, sub: "confirmed requests",      valColor: "#3b6d11" },
          { label: "Approved Hours", value: stats.approvedHours, icon: <TrendingUp   size={13} color="#f97316" />, sub: "from approved requests",  valColor: "#f97316" },
        ].map((c) => (
          <div key={c.label} style={{ ...BOX, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 5 }}>{c.icon} {c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, color: c.valColor ?? "#1a1a1a" }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* REQUESTS TABLE */}
      <div style={BOX}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e5e5", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
            <Clock size={15} color="#f97316" />
            Employee Overtime Requests
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>{dateFilteredRequests.length} of {requests.length}</div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", background: "#fff", maxWidth: 320, flex: 1 }}>
            <Search size={13} color="#bbb" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee, email, or reason…"
              style={{ border: "none", outline: "none", fontSize: 12, color: "#1a1a1a", background: "transparent", width: "100%" }}
            />
          </div>
          <button
            onClick={fetchRequests}
            title="Refresh"
            style={{ width: 32, height: 32, borderRadius: 8, border: "0.5px solid #d0d0d0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#888", flexShrink: 0 }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 16px", borderBottom: "0.5px solid #e5e5e5", overflowX: "auto" }}>
          {TABS.map((t) => {
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
                  {COLUMNS.map((col) => (
                    <th
                      key={col.label}
                      onClick={() => toggleSort(col.key)}
                      style={{ width: col.w, fontSize: 11, fontWeight: 500, color: "#888", textAlign: col.align, padding: "8px 12px", borderBottom: "0.5px solid #e5e5e5", background: "#fafaf9", whiteSpace: "nowrap", cursor: col.key ? "pointer" : "default", userSelect: "none" }}
                    >
                      {col.label} {col.key && <SortIcon col={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ padding: "48px 16px", textAlign: "center" }}>
                      <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "#f97316" }} />
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px", gap: 8 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Search size={16} color="#bbb" />
                        </div>
                        <div style={{ fontSize: 13, color: "#888" }}>No records found</div>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map((row) => {
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
                            <User size={13} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>
                              {row.requester?.profile?.firstName} {row.requester?.profile?.lastName}
                            </div>
                            <div style={{ fontSize: 11, color: "#888" }}>{row.requester?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#f97316" }}>{Number(row.requestedHours).toFixed(2)}h</span>
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, color: "#888" }}>{row.lateHours ? Number(row.lateHours).toFixed(2) : "0.00"}h</span>
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: "center" }}>
                        <StatusPill status={row.status} />
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, color: "#888" }}>{row.createdAt ? fmtSubmitted(row.createdAt) : "—"}</span>
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle", maxWidth: 180 }}>
                        <div style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.requesterReason || "No reason provided"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SIDE PANEL */}
          {selectedRow && (
            <div style={{ width: 280, minWidth: 280, borderLeft: "0.5px solid #e5e5e5", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "0.5px solid #e5e5e5" }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>Request details</span>
                <button onClick={closePanel} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", display: "flex", alignItems: "center", padding: 2, borderRadius: 8 }}>
                  <X size={15} />
                </button>
              </div>
              <div style={{ padding: 14, flex: 1, overflowY: "auto" }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>
                  {selectedRow.requester?.profile?.firstName} {selectedRow.requester?.profile?.lastName}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{selectedRow.requester?.email}</div>
                <StatusPill status={selectedRow.status} />

                <div style={SEC_LBL}>Overtime details</div>
                {[
                  ["OT hours",   `${Number(selectedRow.requestedHours).toFixed(2)}h`],
                  ["Late hours", `${selectedRow.lateHours ? Number(selectedRow.lateHours).toFixed(2) : "0.00"}h`],
                  ["Submitted",  selectedRow.createdAt ? fmtMMDDYYYY_hhmma(selectedRow.createdAt) : "—"],
                  ["TimeLog ID", selectedRow.timeLogId ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: k === "TimeLog ID" ? 11 : 12, fontWeight: 500, textAlign: "right", fontFamily: k === "TimeLog ID" ? "ui-monospace, monospace" : undefined, wordBreak: "break-all" }}>{v}</span>
                  </div>
                ))}

                <div style={SEC_LBL}>Reason for overtime</div>
                <div style={{ background: "#fafaf9", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#888" }}>
                  {selectedRow.requesterReason || "No reason provided"}
                </div>

                {selectedRow.approverComments && (
                  <>
                    <div style={SEC_LBL}>{selectedRow.status === "approved" ? "Approval comment" : "Rejection comment"}</div>
                    <div style={{
                      background: selectedRow.status === "approved" ? "#eaf3de" : "#fcebeb",
                      border: `0.5px solid ${selectedRow.status === "approved" ? "#97c459" : "#f09595"}`,
                      borderRadius: 8, padding: "8px 10px", fontSize: 12,
                      color: selectedRow.status === "approved" ? "#3b6d11" : "#791f1f",
                    }}>
                      {selectedRow.approverComments}
                    </div>
                  </>
                )}

                {canAct && selectedRow.status === "pending" && (
                  <>
                    <div style={SEC_LBL}>Actions</div>
                    {actionType === null ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          onClick={() => setActionType("approve")}
                          className="h-8 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white flex-1 gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          onClick={() => setActionType("reject")}
                          variant="outline"
                          className="h-8 text-xs rounded-lg border-[0.5px] border-red-300 text-red-600 hover:bg-red-50 flex-1 gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder={`Add ${actionType === "approve" ? "approval" : "rejection"} comments${actionType === "reject" ? " (required)" : " (optional)"}…`}
                          className="resize-none text-xs border-[0.5px] border-[#d0d0d0] rounded-lg min-h-[64px]"
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <Button
                            variant="outline"
                            className="h-8 text-xs rounded-lg border-[0.5px] border-[#d0d0d0] flex-1"
                            onClick={() => { setActionType(null); setComment(""); }}
                            disabled={actionLoading}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleAction(actionType)}
                            disabled={actionLoading || (actionType === "reject" && !comment.trim())}
                            className={`h-8 text-xs rounded-lg text-white flex-1 gap-1.5 ${actionType === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                          >
                            {actionLoading
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : actionType === "approve" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                            Confirm {actionType === "approve" ? "approval" : "rejection"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
    </div>
  );
}
