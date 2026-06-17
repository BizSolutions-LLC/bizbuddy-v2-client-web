"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  ChevronsLeft,
  ChevronsRight,
  TimerOff,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PER_PAGE = 10;

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtShort = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—";

// ── Approver helpers ───────────────────────────────────────────────────────────
const getApproverName = (row) => {
  if (row?.approver?.profile) {
    const { firstName, lastName } = row.approver.profile;
    return [firstName, lastName].filter(Boolean).join(" ") || row.approver.email || "—";
  }
  return row?.approver?.email || "Not assigned";
};
const getApproverEmail = (row) => row?.approver?.email || "";

// ── Status pill ────────────────────────────────────────────────────────────────
function Pill({ status }) {
  const s = status?.toLowerCase();
  const cfg = {
    pending:  { bg: "#faeeda", color: "#633806", Icon: Clock,        label: "Pending"  },
    approved: { bg: "#eaf3de", color: "#3b6d11", Icon: CheckCircle2, label: "Approved" },
    rejected: { bg: "#fcebeb", color: "#791f1f", Icon: XCircle,      label: "Rejected" },
  }[s] ?? { bg: "#faeeda", color: "#633806", Icon: Clock, label: status };
  const { Icon } = cfg;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 20, fontSize: 11, fontWeight: 500, padding: "3px 8px", background: cfg.bg, color: cfg.color }}>
      <Icon style={{ width: 11, height: 11 }} />
      {cfg.label}
    </span>
  );
}

// ── Sort icon ──────────────────────────────────────────────────────────────────
function SortIcon({ col, sortKey, sortDir }) {
  const active = col === sortKey;
  const color = active ? "#f97316" : "#bbb";
  const Icon = active ? (sortDir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
  return <Icon style={{ width: 10, height: 10, marginLeft: 3, color, display: "inline", verticalAlign: "middle" }} />;
}

// ── Pagination button ──────────────────────────────────────────────────────────
function PageBtn({ children, active, disabled, onClick }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        border: `0.5px solid ${active ? "#f97316" : "#e5e5e5"}`,
        background: active ? "#f97316" : "#fff",
        color: active ? "#fff" : "#888",
        borderRadius: 8,
        padding: "4px 9px",
        fontSize: 12,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 3,
        fontFamily: "inherit",
        fontWeight: active ? 500 : 400,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ── Side panel sub-components ──────────────────────────────────────────────────
function SectionLbl({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "#bbb", marginBottom: 8, marginTop: 14 }}>
      {children}
    </div>
  );
}

function DetailRow({ label, value, small }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
      <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: small ? 11 : 12, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function IdRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5, gap: 8 }}>
      <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#888", textAlign: "right", wordBreak: "break-all" }}>{value || "—"}</span>
    </div>
  );
}

// ── Side panel ─────────────────────────────────────────────────────────────────
function PanelContent({ req, onClose }) {
  const hours = Number(req.requestedHours || 0).toFixed(2);
  const late  = Number(req.lateHours      || 0).toFixed(2);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "0.5px solid #e5e5e5", flexShrink: 0 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>Request details</span>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", display: "flex", alignItems: "center", padding: 2, borderRadius: 8 }}>
          <X style={{ width: 15, height: 15 }} />
        </button>
      </div>

      <div style={{ padding: 14, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 26, fontWeight: 500, color: "#f97316", lineHeight: 1, marginBottom: 3 }}>{hours}h</div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Overtime hours</div>
        <div style={{ marginBottom: 4 }}><Pill status={req.status} /></div>

        <SectionLbl>Approver</SectionLbl>
        <DetailRow label="Name"  value={getApproverName(req)} />
        {getApproverEmail(req) && <DetailRow label="Email" value={getApproverEmail(req)} small />}

        <SectionLbl>Request info</SectionLbl>
        <DetailRow label="Reason"       value={req.requesterReason || "No reason provided"} />
        <DetailRow label="Late hours"   value={`${late}h`} />
        <DetailRow label="Submitted"    value={fmtShort(req.createdAt)} />
        <DetailRow label="Time"         value={fmtTime(req.createdAt)} />
        <DetailRow label="Last updated" value={fmtShort(req.updatedAt)} />

        {req.approverComments && (
          <>
            <SectionLbl>Comments</SectionLbl>
            <div style={{ background: "#fafaf9", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#888", marginBottom: 6 }}>
              {req.approverComments}
            </div>
          </>
        )}

        <div style={{ height: "0.5px", background: "#e5e5e5", margin: "8px 0" }} />

        <IdRow label="Request ID" value={req.id} />
        <IdRow label="TimeLog ID" value={req.timeLogId} />
      </div>
    </>
  );
}

// ── Skeleton row ───────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "0.5px solid #e5e5e5" }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <td key={i} style={{ padding: "10px 12px" }}>
          <div style={{ height: 14, borderRadius: 4, background: "#f0f0f0" }} />
        </td>
      ))}
    </tr>
  );
}

// ── Column defs ────────────────────────────────────────────────────────────────
const COLS = [
  { key: "createdAt",       label: "Date submitted",  align: "left"   },
  { key: "requestedHours",  label: "Hours requested", align: "right"  },
  { key: "status",          label: "Status",          align: "center" },
  { key: "approver",        label: "Approver",        align: "left"   },
  { key: "requesterReason", label: "Reason",          align: "left"   },
  { key: "updatedAt",       label: "Last updated",    align: "right"  },
];

const getSortVal = (row, key) => {
  switch (key) {
    case "createdAt":       return new Date(row.createdAt).getTime();
    case "requestedHours":  return Number(row.requestedHours) || 0;
    case "status":          return row.status || "";
    case "approver":        return getApproverName(row).toLowerCase();
    case "requesterReason": return (row.requesterReason || "").toLowerCase();
    case "updatedAt":       return new Date(row.updatedAt).getTime();
    default: return 0;
  }
};

// ── Page numbers — windowed around current ─────────────────────────────────────
function getPageNums(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1].filter(p => p >= 1 && p <= total));
  return [...set].sort((a, b) => a - b);
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function EmployeeOvertimeRequests() {
  const { token } = useAuthStore();

  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [activeTab,   setActiveTab]   = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey,     setSortKey]     = useState("createdAt");
  const [sortDir,     setSortDir]     = useState(-1);   // -1 = desc, 1 = asc
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReq, setSelectedReq] = useState(null);

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/overtime/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch overtime requests");
      setRequests(data.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to fetch overtime requests");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total         = requests.length;
    const pending       = requests.filter(r => r.status === "pending").length;
    const approved      = requests.filter(r => r.status === "approved").length;
    const rejected      = requests.filter(r => r.status === "rejected").length;
    const approvedHours = requests
      .filter(r => r.status === "approved")
      .reduce((s, r) => s + Number(r.requestedHours || 0), 0);
    return { total, pending, approved, rejected, approvedHours: approvedHours.toFixed(2) };
  }, [requests]);

  const tabCounts = useMemo(() => ({
    all:      requests.length,
    pending:  requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  }), [requests]);

  // ── Filtered + sorted ──────────────────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let data = requests.filter(r => {
      const matchTab = activeTab === "all" || r.status === activeTab;
      const matchQ   = !q ||
        (r.requesterReason  || "").toLowerCase().includes(q) ||
        getApproverName(r).toLowerCase().includes(q) ||
        (r.approver?.email  || "").toLowerCase().includes(q) ||
        fmtShort(r.createdAt).toLowerCase().includes(q);
      return matchTab && matchQ;
    });
    return [...data].sort((a, b) => {
      const av = getSortVal(a, sortKey);
      const bv = getSortVal(b, sortKey);
      return av > bv ? sortDir : av < bv ? -sortDir : 0;
    });
  }, [requests, activeTab, searchQuery, sortKey, sortDir]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PER_PAGE));
  const safePage   = Math.min(currentPage, totalPages);
  const pageRows   = filteredSorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const pageNums   = getPageNums(safePage, totalPages);

  const goPage = (p) => { setCurrentPage(p); setSelectedReq(null); };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
    setCurrentPage(1);
  };

  const handleTabChange = (tab) => { setActiveTab(tab); setCurrentPage(1); setSelectedReq(null); };

  const toggleRow = (row) => setSelectedReq(prev => prev?.id === row.id ? null : row);

  return (
    <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-6">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex flex-col gap-0.5 min-w-0 py-1">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 leading-tight">
          <Clock className="h-5 w-5 text-orange-500 flex-shrink-0" />
          Overtime Requests
        </h2>
        <p className="text-sm text-muted-foreground">View and track your overtime request history</p>
      </div>

      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-xl border p-3 flex flex-col gap-2.5">
              <Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-10 mt-0.5" /><Skeleton className="h-3 w-20 mt-0.5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><FileText className="h-3.5 w-3.5 text-orange-500" />Total requests</div>
            <div className="text-2xl font-medium leading-none mt-0.5">{stats.total}</div>
            <div className="text-[11px] text-muted-foreground/60 mt-0.5">all time</div>
          </div>
          <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><TimerOff className="h-3.5 w-3.5" style={{ color: "#633806" }} />Pending</div>
            <div className="text-2xl font-medium leading-none mt-0.5" style={{ color: "#633806" }}>{stats.pending}</div>
            <div className="text-[11px] text-muted-foreground/60 mt-0.5">awaiting review</div>
          </div>
          <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#3b6d11" }} />Approved</div>
            <div className="text-2xl font-medium leading-none mt-0.5" style={{ color: "#3b6d11" }}>{stats.approved}</div>
            <div className="text-[11px] text-muted-foreground/60 mt-0.5">accepted requests</div>
          </div>
          <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-orange-500" />Approved hours</div>
            <div className="text-2xl font-medium leading-none mt-0.5 text-orange-500">{stats.approvedHours}</div>
            <div className="text-[11px] text-muted-foreground/60 mt-0.5">total approved</div>
          </div>
        </div>
      )}

      {/* ── V2 Table ── */}
      <div style={{ border: "0.5px solid #e5e5e5", borderRadius: 12, overflow: "hidden", background: "#fff" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
          <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
            <Clock style={{ width: 15, height: 15, color: "#f97316" }} />
            Overtime requests
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>{pageRows.length} shown</div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", background: "#fff", maxWidth: 320 }}>
            <Search style={{ width: 13, height: 13, color: "#bbb", flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); setSelectedReq(null); }}
              placeholder="Search by reason, approver, or date…"
              style={{ border: "none", outline: "none", fontSize: 12, fontFamily: "inherit", color: "#1a1a1a", background: "transparent", width: "100%" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", display: "flex", padding: 0 }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            )}
          </div>
        </div>

        {/* Status tabs */}
        <div style={{ display: "flex", padding: "0 16px", borderBottom: "0.5px solid #e5e5e5" }}>
          {[
            { key: "all",      label: "All"      },
            { key: "pending",  label: "Pending"  },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
          ].map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "8px 10px",
                  fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                  color: isActive ? "#f97316" : "#888",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${isActive ? "#f97316" : "transparent"}`,
                  marginBottom: -0.5,
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  transition: "color .15s",
                }}
              >
                {label}
                <span style={{ fontSize: 11, borderRadius: 20, padding: "1px 6px", fontWeight: 400, background: isActive ? "#faeeda" : "#f5f5f3", color: isActive ? "#633806" : "#888" }}>
                  {tabCounts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body: table + panel */}
        <div style={{ display: "flex" }}>

          {/* Table wrap — overflow-x auto always (min-width table causes scroll on mobile) */}
          <div
            className="transition-all duration-200"
            style={selectedReq ? { flex: 1, overflowX: "auto", minWidth: 0 } : { width: "100%", overflowX: "auto" }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
              <thead>
                <tr>
                  {COLS.map((col, ci) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        fontSize: 11, fontWeight: 500, color: "#888",
                        textAlign: col.align,
                        padding: "8px 12px",
                        borderBottom: "0.5px solid #e5e5e5",
                        background: "#fafaf9",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        userSelect: "none",
                        ...(ci === 0 ? { position: "sticky", left: 0, zIndex: 2, background: "#fafaf9", borderRight: "0.5px solid #d0d0d0" } : {}),
                      }}
                    >
                      {col.label}
                      <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
                ) : pageRows.length > 0 ? (
                  pageRows.map(row => {
                    const isSelected = selectedReq?.id === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => toggleRow(row)}
                        className={isSelected ? "" : "hover:bg-[#fafaf9]"}
                        style={{
                          borderBottom: "0.5px solid #e5e5e5",
                          cursor: "pointer",
                          background: isSelected ? "#fff7f0" : undefined,
                          borderLeft: isSelected ? "2px solid #f97316" : undefined,
                          transition: "background .1s",
                        }}
                      >
                        {/* Date submitted — always sticky */}
                        <td style={{
                          padding: "10px 12px", verticalAlign: "middle",
                          position: "sticky", left: 0, zIndex: 1,
                          background: isSelected ? "#fff7f0" : "#fff",
                          borderRight: "0.5px solid #d0d0d0",
                        }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{fmtShort(row.createdAt)}</div>
                          <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{fmtTime(row.createdAt)}</div>
                        </td>

                        {/* Hours requested */}
                        <td style={{ padding: "10px 12px", verticalAlign: "middle", textAlign: "right" }}>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{Number(row.requestedHours || 0).toFixed(2)}h</span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "10px 12px", verticalAlign: "middle", textAlign: "center" }}>
                          <Pill status={row.status} />
                        </td>

                        {/* Approver */}
                        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                          <div style={{ fontSize: 13 }}>{getApproverName(row)}</div>
                          {getApproverEmail(row) && (
                            <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{getApproverEmail(row)}</div>
                          )}
                        </td>

                        {/* Reason */}
                        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                          <span style={{ fontSize: 12, color: "#888", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                            {row.requesterReason || "No reason provided"}
                          </span>
                        </td>

                        {/* Last updated */}
                        <td style={{ padding: "10px 12px", verticalAlign: "middle", textAlign: "right" }}>
                          <span style={{ fontSize: 12, color: "#888" }}>{fmtShort(row.updatedAt)}</span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", gap: 8 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Search style={{ width: 16, height: 16, color: "#bbb" }} />
                        </div>
                        <div style={{ fontSize: 13, color: "#888" }}>No records found</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Inline side panel */}
          {selectedReq && (
            <div style={{ width: 272, minWidth: 272, borderLeft: "0.5px solid #e5e5e5", display: "flex", flexDirection: "column" }}>
              <PanelContent req={selectedReq} onClose={() => setSelectedReq(null)} />
            </div>
          )}
        </div>

        {/* Pagination footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "10px 16px", borderTop: "0.5px solid #e5e5e5", background: "#fafaf9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <PageBtn disabled={safePage === 1} onClick={() => goPage(1)}>
              <ChevronsLeft style={{ width: 12, height: 12 }} /> First
            </PageBtn>
            {pageNums.map(p => (
              <PageBtn key={p} active={p === safePage} onClick={() => goPage(p)}>{p}</PageBtn>
            ))}
            <PageBtn disabled={safePage === totalPages} onClick={() => goPage(totalPages)}>
              Last <ChevronsRight style={{ width: 12, height: 12 }} />
            </PageBtn>
          </div>
          <span style={{ fontSize: 12, color: "#888" }}>
            Page {safePage} of {totalPages} · {filteredSorted.length} records
          </span>
        </div>

      </div>
    </div>
  );
}
