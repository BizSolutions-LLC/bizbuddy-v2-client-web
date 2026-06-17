"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import useAuthStore from "@/store/useAuthStore";
import { toast, Toaster } from "sonner";
import {
  Clock,
  RefreshCw,
  Timer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  FileText,
  Calendar,
  Activity,
  ChevronDown,
  SlidersHorizontal,
  TimerOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ── V2 reason map ──────────────────────────────────────────────────────────────
const REASON_MAP = {
  network_delay: "Network delay",
  system_malfunction: "System malfunction",
  forgot_to_clock_in: "Forgot to clock in",
  remote_work: "Remote work",
  other: "Other",
};
const fmtReason = (r) => REASON_MAP[r] || r || "—";

// ── V2 status pill ─────────────────────────────────────────────────────────────
function PillV2({ status }) {
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

// ── V2 panel sub-components ────────────────────────────────────────────────────
function DetailRowV2({ label, value, orange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
      <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, textAlign: "right", color: orange ? "#f97316" : "#1a1a1a" }}>{value}</span>
    </div>
  );
}

function IdRowV2({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5, gap: 8 }}>
      <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#888", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function SectionLabelV2({ children, topGap = 14 }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "#aaa", marginBottom: 8, marginTop: topGap }}>
      {children}
    </div>
  );
}

function DividerV2() {
  return <div style={{ height: "0.5px", background: "#e5e5e5", margin: "10px 0" }} />;
}

function PanelContentV2({ log, onClose }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "0.5px solid #e5e5e5", flexShrink: 0 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>Contest details</span>
        <button
          onClick={onClose}
          aria-label="Close panel"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", display: "flex", alignItems: "center", padding: 2, borderRadius: 8 }}
        >
          <X style={{ width: 15, height: 15 }} />
        </button>
      </div>

      <div style={{ padding: 14, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 5 }}>
          {log.requestedClockIn ? format(parseISO(log.requestedClockIn), "EEEE, MMMM d, yyyy") : "—"}
        </div>
        <div style={{ marginBottom: 4 }}>
          <PillV2 status={log.status} />
        </div>

        <SectionLabelV2>Requested times</SectionLabelV2>
        <DetailRowV2 label="Clock in"  value={log.requestedClockIn  ? format(parseISO(log.requestedClockIn),  "hh:mm a") : "—"} orange />
        <DetailRowV2 label="Clock out" value={log.requestedClockOut ? format(parseISO(log.requestedClockOut), "hh:mm a") : "—"} orange />

        <DividerV2 />

        <SectionLabelV2 topGap={6}>Original times</SectionLabelV2>
        <DetailRowV2 label="Clock in"  value={log.currentClockIn  ? format(parseISO(log.currentClockIn),  "hh:mm a") : "—"} />
        <DetailRowV2 label="Clock out" value={log.currentClockOut ? format(parseISO(log.currentClockOut), "hh:mm a") : "—"} />

        <SectionLabelV2>Request info</SectionLabelV2>
        <DetailRowV2 label="Reason" value={fmtReason(log.reason)} />
        {log.description && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Description</div>
            <div style={{ background: "#fafaf9", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#888" }}>
              {log.description}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>Submitted</span>
          <span style={{ fontSize: 12, fontWeight: 500, textAlign: "right" }}>
            {format(parseISO(log.createdAt), "MMM d, yyyy")}
          </span>
        </div>

        {log.approver && (
          <>
            <SectionLabelV2>Approver</SectionLabelV2>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
              <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>Name</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>
                  {log.approver.profile?.firstName} {log.approver.profile?.lastName}
                </div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{log.approver.email}</div>
              </div>
            </div>
          </>
        )}

        <DividerV2 />

        <IdRowV2 label="Contest ID"   value={`#${log.id}`} />
        <IdRowV2 label="Time log ref" value={`#${log.timeLogId || "N/A"}`} />
      </div>
    </>
  );
}

// ── V2 skeleton row ────────────────────────────────────────────────────────────
function V2SkeletonRow() {
  return (
    <tr style={{ borderBottom: "0.5px solid #e5e5e5" }}>
      {[18, 14, 14, 16, 22, 16].map((w, i) => (
        <td key={i} style={{ padding: "10px 12px" }}>
          <div style={{ height: 14, borderRadius: 4, background: "#f0f0f0" }} />
        </td>
      ))}
    </tr>
  );
}


export default function ContestTimeLogs() {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [contestLogs, setContestLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo, setPendingTo] = useState("");
  const [selectedLogV2, setSelectedLogV2] = useState(null);

  const fetchContestLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter && statusFilter.toLowerCase() !== "all") {
        queryParams.append("status", statusFilter.toUpperCase());
      }

      const res = await fetch(
        `${API_URL}/api/contest-policy/view-contestTimeLogs?${queryParams.toString()}`,
        { method: "GET", headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();
      if (res.ok) {
        setContestLogs(data.data?.contestLogs || []);
      } else {
        toast.error(data.message || "Failed to fetch contest logs.");
      }
    } catch (err) {
      console.error("Error fetching contest logs:", err);
      toast.error("Failed to fetch contest logs.");
    } finally {
      setLoading(false);
    }
  }, [token, API_URL, statusFilter]);

  useEffect(() => {
    fetchContestLogs();
  }, [fetchContestLogs]);

  const filteredLogs = useMemo(() => {
    let filtered = [...contestLogs];

    if (statusFilter !== "all") {
      filtered = filtered.filter(log => log.status?.toLowerCase() === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.reason?.toLowerCase().includes(query) ||
        log.id?.toString().includes(query)
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(log => {
        const logDate = parseISO(log.contestDate || log.createdAt);
        return logDate >= new Date(dateFrom);
      });
    }
    if (dateTo) {
      filtered = filtered.filter(log => {
        const logDate = parseISO(log.contestDate || log.createdAt);
        return logDate <= new Date(dateTo);
      });
    }

    return filtered;
  }, [contestLogs, statusFilter, searchQuery, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total    = contestLogs.length;
    const pending  = contestLogs.filter(log => log.status?.toLowerCase() === "pending").length;
    const approved = contestLogs.filter(log => log.status?.toLowerCase() === "approved").length;
    const rejected = contestLogs.filter(log => log.status?.toLowerCase() === "rejected").length;
    return { total, pending, approved, rejected };
  }, [contestLogs]);

  const exportToCSV = async () => {
    if (filteredLogs.length === 0) return toast.error("No data to export");
    try {
      const { exportContestLogsCSV } = await import("@/lib/exports/contestLogs");
      const result = await exportContestLogsCSV({ data: filteredLogs });
      if (result.success) toast.success(`${result.filename}`);
    } catch (error) {
      toast.error(`Export failed: ${error.message}`);
    }
  };

  const exportToPDF = async () => {
    if (filteredLogs.length === 0) return toast.error("No data to export");
    try {
      const { exportContestLogsPDF } = await import("@/lib/exports/contestLogs");
      const result = await exportContestLogsPDF({ data: filteredLogs });
      if (result.success) toast.success(`${result.filename}`);
    } catch (error) {
      toast.error(`Export failed: ${error.message}`);
    }
  };

  const toggleLogV2 = (log) => {
    setSelectedLogV2(prev => prev?.id === log.id ? null : log);
  };

  // V2 table column definitions
  const V2_COLS = [
    { label: "Contest date", width: "18%", align: "left"   },
    { label: "Time in",      width: "14%", align: "left"   },
    { label: "Time out",     width: "14%", align: "left"   },
    { label: "Status",       width: "16%", align: "center" },
    { label: "Reason",       width: "22%", align: "left"   },
    { label: "Submitted",    width: "16%", align: "right"  },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-6">
        <Toaster position="top-center" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 leading-tight">
              <Activity className="h-5 w-5 text-orange-500 flex-shrink-0" />
              Contest Time Logs
            </h2>
            <p className="text-sm text-muted-foreground">View and track your time contest requests</p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-start sm:justify-end">
            <Button asChild className="hidden md:inline-flex h-8 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 gap-1.5">
              <Link href="/dashboard/employee/punch">
                <Clock className="h-3.5 w-3.5" />
                Punch
              </Link>
            </Button>

            <Button variant="outline" className="h-8 text-xs rounded-lg px-2.5 gap-1.5" asChild>
              <Link href="/dashboard/employee/punch-logs">
                <Timer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Punch Logs</span>
                <span className="sm:hidden">Logs</span>
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden sm:inline-flex h-8 text-xs rounded-lg px-2.5 gap-1.5" disabled={filteredLogs.length === 0}>
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[170px]">
                <DropdownMenuItem onClick={exportToCSV} disabled={filteredLogs.length === 0}>
                  <Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportToPDF} disabled={filteredLogs.length === 0}>
                  <FileText className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="icon" className="hidden sm:inline-flex h-8 w-8 rounded-lg" onClick={fetchContestLogs} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border p-3 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10 mt-0.5" />
                <Skeleton className="h-3 w-20 mt-0.5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FileText className="h-3.5 w-3.5 text-orange-500" />Total contests
              </div>
              <div className="text-2xl font-medium leading-none mt-0.5">{stats.total}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">all time requests</div>
            </div>
            <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <TimerOff className="h-3.5 w-3.5" style={{ color: "#633806" }} />Pending
              </div>
              <div className="text-2xl font-medium leading-none mt-0.5" style={{ color: "#633806" }}>{stats.pending}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">awaiting review</div>
            </div>
            <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#3b6d11" }} />Approved
              </div>
              <div className="text-2xl font-medium leading-none mt-0.5" style={{ color: "#3b6d11" }}>{stats.approved}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">accepted requests</div>
            </div>
            <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <XCircle className="h-3.5 w-3.5" style={{ color: "#b91c1c" }} />Rejected
              </div>
              <div className="text-2xl font-medium leading-none mt-0.5" style={{ color: "#b91c1c" }}>{stats.rejected}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">declined requests</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card rounded-xl border p-3">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <SlidersHorizontal className="h-3.5 w-3.5 text-orange-500" />
              Filters &amp; controls
            </div>
            <span className="text-xs text-muted-foreground">{filteredLogs.length} shown · {contestLogs.length} total</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end flex-wrap gap-2">
            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <AlertCircle className="h-2.5 w-2.5" />Status
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 flex-[2] min-w-[200px]">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />Date range
              </div>
              <div className="flex items-center gap-1.5">
                <Input type="date" value={pendingFrom} onChange={(e) => setPendingFrom(e.target.value)} className="h-8 text-xs flex-1 rounded-lg" />
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Input type="date" value={pendingTo} onChange={(e) => setPendingTo(e.target.value)} className="h-8 text-xs flex-1 rounded-lg" />
              </div>
            </div>
            <Button
              size="sm"
              className="h-8 bg-orange-500 hover:bg-orange-600 text-white self-end rounded-lg"
              onClick={() => { setDateFrom(pendingFrom); setDateTo(pendingTo); }}
            >
              Apply
            </Button>
          </div>
        </div>

        {/* ── V2 Table ────────────────────────────────────────────────────────── */}
        <div style={{ border: "0.5px solid #e5e5e5", borderRadius: 12, overflow: "hidden", background: "#fff" }}>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
            <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
              <Activity style={{ width: 15, height: 15, color: "#f97316" }} />
              Contest logs
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>{filteredLogs.length} shown</div>
          </div>

          {/* Body: table + side panel — inline on all screen sizes, same pattern as Punch Logs */}
          <div style={{ display: "flex" }}>

            {/* Table wrap — flex-1 + overflow-x auto when panel is open so table scrolls horizontally on narrow screens */}
            <div
              className="transition-all duration-200"
              style={selectedLogV2
                ? { flex: 1, overflowX: "auto", minWidth: 0 }
                : { width: "100%", overflowX: "auto" }
              }
            >
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: selectedLogV2 ? 360 : 480 }}>
                <thead>
                  <tr>
                    {V2_COLS.map(({ label, width, align }, colIdx) => (
                      <th
                        key={label}
                        style={{
                          width,
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#888",
                          textAlign: align,
                          padding: "8px 12px",
                          borderBottom: "0.5px solid #e5e5e5",
                          background: "#fafaf9",
                          whiteSpace: "nowrap",
                          ...(colIdx === 0 ? { position: "sticky", left: 0, zIndex: 2 } : {}),
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => <V2SkeletonRow key={i} />)
                  ) : filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => {
                      const isSelected = selectedLogV2?.id === log.id;
                      return (
                        <tr
                          key={log.id}
                          onClick={() => toggleLogV2(log)}
                          className={isSelected ? "" : "hover:bg-[#fafaf9]"}
                          style={{
                            borderBottom: "0.5px solid #e5e5e5",
                            cursor: "pointer",
                            background: isSelected ? "#fff7f0" : undefined,
                            borderLeft: isSelected ? "2px solid #f97316" : undefined,
                            transition: "background 0.1s",
                          }}
                        >
                          {/* Contest date — sticky so it stays visible when table scrolls horizontally on mobile */}
                          <td style={{
                            padding: "10px 12px",
                            verticalAlign: "middle",
                            overflow: "hidden",
                            position: "sticky",
                            left: 0,
                            zIndex: 1,
                            background: isSelected ? "#fff7f0" : "#fff",
                          }}>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>
                              {log.requestedClockIn ? format(parseISO(log.requestedClockIn), "EEE, MMMM d") : "—"}
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "middle", overflow: "hidden" }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                              {log.requestedClockIn ? format(parseISO(log.requestedClockIn), "hh:mm a") : "—"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "middle", overflow: "hidden" }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                              {log.requestedClockOut ? format(parseISO(log.requestedClockOut), "hh:mm a") : "—"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "middle", overflow: "hidden", textAlign: "center" }}>
                            <PillV2 status={log.status} />
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "middle", overflow: "hidden" }}>
                            <span style={{ fontSize: 12, color: "#888" }}>{fmtReason(log.reason)}</span>
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "middle", overflow: "hidden", textAlign: "right" }}>
                            <span style={{ fontSize: 12, color: "#888" }}>
                              {format(parseISO(log.createdAt), "MMM d, yyyy")}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: "48px 12px", textAlign: "center", color: "#aaa", fontSize: 13 }}>
                        No contest logs match the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Side panel — inline on all screen sizes, no bottom sheet */}
            {selectedLogV2 && (
              <div style={{ width: 272, minWidth: 272, borderLeft: "0.5px solid #e5e5e5", display: "flex", flexDirection: "column" }}>
                <PanelContentV2 log={selectedLogV2} onClose={() => setSelectedLogV2(null)} />
              </div>
            )}
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}
