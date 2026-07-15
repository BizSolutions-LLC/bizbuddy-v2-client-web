"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Filter,
  Check,
  X,
  Calendar,
  User,
  FileText,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Building,
  Trash2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { fmtMMDDYYYY_hhmma } from "@/lib/dateTimeFormatter";
import MultiSelect from "@/components/common/MultiSelect";
import ColumnSelector from "@/components/common/ColumnSelector";
import CutoffDateRangeFilter, { periodRangeKey } from "@/components/common/CutoffDateRangeFilter";

export default function AdminContestRequests() {
  const { token, user } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [loading, setLoading] = useState(false);
  const [contestRequests, setContestRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Filter and view states
  const [sortConfig, setSort] = useState({ key: "submittedAt", direction: "descending" });
  const [filters, setFilters] = useState({
    status: ["all"],
    employees: ["all"],
    reasons: ["all"]
  });
  const [cutoffPeriods, setCutoffPeriods] = useState([]);
  const [selectedCutoffId, setSelectedCutoffId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo, setPendingTo] = useState("");

  // Modal / panel states — selectedRequest doubles as "is the detail side panel open"
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Original Punch Log / Requested Times used to be their own table columns, but
  // showing both on every row made the table too cramped to scan. That comparison now
  // lives in the "View Details" modal instead — the table stays to the essentials.
  // Original punch / requested-times columns are always shown (not toggleable) since
  // they're the point of this table; Actions moved into the row-click side panel below.
  const columnOptions = [
    { value: "employee", label: "Employee" },
    { value: "status", label: "Status" },
    { value: "submittedAt", label: "Submitted At" },
  ];

  const [visibleCols, setVisibleCols] = useState(columnOptions.map(o => o.value));

  useEffect(() => {
    const fetchContestRequests = async () => {
      try {
        setLoading(true);
  
        const res = await fetch(`${API}/api/contest-policy/view-allContestTimeLogs`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
  
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to fetch contest requests");
        }
  
        const json = await res.json();  
        const mapped = json.data.map((c) => ({
          id: c.id,
          employee: {
            id: c.userId || "unknown",
            name: c.userDisplayName || "Unknown User",
            email: c.userEmail || "",
          },
          originalClockIn: c.currentClockIn,
          originalClockOut: c.currentClockOut,
          correctClockIn: c.requestedClockIn,
          correctClockOut: c.requestedClockOut,
          reason: c.reason || "N/A",
          detailedExplanation: c.description?.trim() || "No description provided",
          status: c.status?.toLowerCase() || "pending",
          submittedAt: c.submittedAt,
          approvedBy: c.approverDisplayName || null,
          approvedAt: c.approvedAt || null,
        }));

        setContestRequests(mapped);
  
        // Optionally pre-load employee list for filters
        const uniqueEmployees = Array.from(
          new Map(
            mapped.map((r) => [r.employee.id, { id: r.employee.id, name: r.employee.name, email: r.employee.email }])
          ).values()
        );
        setEmployees(uniqueEmployees);
      } catch (err) {
        console.error("❌ Error loading contest requests:", err);
        toast.error("Failed to load contest requests");
      } finally {
        setLoading(false);
      }
    };
  
    if (token) fetchContestRequests();
  }, [token, API]);

  // Company-wide cutoff periods (no departmentId filter — this is an admin view across
  // every department) feed the Date Range filter's quick-select-by-pay-period dropdown.
  useEffect(() => {
    if (!token) return;
    const fetchCutoffPeriods = async () => {
      try {
        const res = await fetch(`${API}/api/cutoff-periods`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await res.json();
        if (res.ok) setCutoffPeriods((j.data || []).sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart)));
      } catch { /* silent */ }
    };
    fetchCutoffPeriods();
  }, [token, API]);

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

  const handleDelete = async (requestId) => {
  
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/api/contest-policy/delete/${requestId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
  
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to delete");
  
      toast.success("Contest request deleted successfully!");
      setContestRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error("❌ Error deleting contest:", err);
      toast.error(err.message || "Failed to delete contest request");
    } finally {
      setActionLoading(false);
    }
  };

  const requestSort = (k) =>
    setSort((p) => ({
      key: k,
      direction: p.key === k && p.direction === "ascending" ? "descending" : "ascending",
    }));

  const changeFilter = (k, v) =>
    setFilters((p) => {
      const n = { ...p };
      if (v === "all") n[k] = ["all"];
      else {
        let arr = p[k].filter((x) => x !== "all");
        arr = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
        if (!arr.length) arr = ["all"];
        n[k] = arr;
      }
      return n;
    });

  const clearFilters = () => {
    setFilters({ status: ["all"], employees: ["all"], reasons: ["all"] });
    setSelectedCutoffId("all");
    setDateFrom(""); setDateTo(""); setPendingFrom(""); setPendingTo("");
  };

  const anyFilterActive =
    !filters.status.includes("all") ||
    !filters.employees.includes("all") ||
    !filters.reasons.includes("all") ||
    !!dateFrom || !!dateTo;

  const filteredRequests = contestRequests.filter(request => {
    const submittedDate = request.submittedAt ? request.submittedAt.slice(0, 10) : null;
    return (
      (filters.status.includes("all") || filters.status.includes(request.status)) &&
      (filters.employees.includes("all") || filters.employees.includes(request.employee.id)) &&
      (filters.reasons.includes("all") || filters.reasons.some(reason =>
        request.reason.toLowerCase().includes(reason.toLowerCase())
      )) &&
      (!dateFrom || (submittedDate && submittedDate >= dateFrom)) &&
      (!dateTo   || (submittedDate && submittedDate <= dateTo))
    );
  }).sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    const getVal = (req, key) => {
      switch (key) {
        case "employee": return req.employee.name.toLowerCase();
        case "status": return req.status;
        case "reason": return req.reason.toLowerCase();
        case "submittedAt": return new Date(req.submittedAt).getTime();
        default: return "";
      }
    };

    const aVal = getVal(a, sortConfig.key);
    const bVal = getVal(b, sortConfig.key);
    if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
    return 0;
  });

  const pendingCount = contestRequests.filter(r => r.status === "pending").length;
  const approvedCount = contestRequests.filter(r => r.status === "approved").length;
  const rejectedCount = contestRequests.filter(r => r.status === "rejected").length;

  const getStatusBadge = (status) => {
    const badges = {
      pending: <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pending</Badge>,
      approved: <Badge className="bg-green-500 hover:bg-green-600 text-white">Approved</Badge>,
      rejected: <Badge className="bg-red-500 hover:bg-red-600 text-white">Rejected</Badge>
    };
    return badges[status] || <Badge variant="outline">Unknown</Badge>;
  };

  // Requested-time color follows the request's status (green once approved, orange
  // while pending, red once denied) rather than whether the field differs from the
  // original — the original column stays plain black, this is the one that needs to
  // read as "what state is this correction in."
  const requestedTimeColor = (status) => {
    if (status === "approved") return "text-green-600 dark:text-green-400";
    if (status === "rejected") return "text-red-600 dark:text-red-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const handleApproveReject = async (requestId, action) => {
    setActionLoading(true);
  
    try {
      const endpoint =
        action === "approved"
          ? `${API}/api/contest-policy/approve/${requestId}`
          : `${API}/api/contest-policy/reject/${requestId}`;
  
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
  
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update request");
  
      // Update table immediately after success
      setContestRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: action,
                approvedBy:
                  user?.profile?.firstName + " " + user?.profile?.lastName || "Admin",
                approvedAt: new Date().toISOString(),
              }
            : req
        )
      );
  
      toast.success(
        `Contest request ${action === "approved" ? "approved" : "rejected"} successfully!`
      );
      setSelectedRequest(null);
    } catch (err) {
      console.error(`❌ Failed to ${action} request:`, err);
      toast.error(`Failed to ${action} contest request.`);
    } finally {
      setActionLoading(false);
    }
  };

  const statusOpts = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" }
  ];

  const employeeOpts = employees.map(emp => ({ value: emp.id, label: emp.name }));

  const reasonOpts = [
    { value: "system_clock_error", label: "System Clock Error" },
    { value: "device_malfunction", label: "Device Malfunction" },
    { value: "network_issue", label: "Network Issue" },
    { value: "power_outage", label: "Power Outage" },
    { value: "other", label: "Other" }
  ];

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  // Table time cells stack a time above its date on two lines — unlike formatDateTime,
  // a missing/invalid value here is a real signal worth surfacing ("Invalid date" in
  // red), not something to paper over with a dash, since a missing original clock-out
  // is often exactly why the contest request exists.
  const formatTimeOnly = (dateStr) => {
    const d = new Date(dateStr);
    if (!dateStr || isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };
  const formatDateOnly = (dateStr) => {
    const d = new Date(dateStr);
    if (!dateStr || isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="max-w-full mx-auto p-4 lg:px-10 space-y-8">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-orange-500" />
            Contest Requests Management
          </h2>
          <p className="text-muted-foreground mt-1">Review and approve employee time contest requests</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 shadow-md">
          <div className="h-1 w-full bg-yellow-500" />
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-yellow-500/10 text-yellow-600">
                <Clock className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-lg sm:text-2xl font-bold">{pendingCount}</p>
                <p className="text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md">
          <div className="h-1 w-full bg-green-500" />
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-green-500/10 text-green-600">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-lg sm:text-2xl font-bold">{approvedCount}</p>
                <p className="text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md">
          <div className="h-1 w-full bg-red-500" />
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-red-500/10 text-red-600">
                <XCircle className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-lg sm:text-2xl font-bold">{rejectedCount}</p>
                <p className="text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Controls */}
      <Card className="border-2 shadow-md">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-2 relative">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <Filter className="h-5 w-5" />
            </div>
            Table Controls
          </CardTitle>
          <span className="absolute top-2 right-4 text-sm text-muted-foreground">
            {filteredRequests.length} of {contestRequests.length}
          </span>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <span className="my-auto shrink-0 text-sm font-medium text-muted-foreground">Column:</span>
              <ColumnSelector options={columnOptions} visible={visibleCols} setVisible={setVisibleCols} />
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="my-auto shrink-0 text-sm font-medium text-muted-foreground">Filter:</span>
              <MultiSelect
                options={statusOpts}
                selected={filters.status}
                onChange={(v) => changeFilter("status", v)}
                allLabel="All Status"
                width={150}
              />
              <MultiSelect
                options={employeeOpts}
                selected={filters.employees}
                onChange={(v) => changeFilter("employees", v)}
                allLabel="All Employees"
                icon={User}
                width={180}
              />
              <MultiSelect
                options={reasonOpts}
                selected={filters.reasons}
                onChange={(v) => changeFilter("reasons", v)}
                allLabel="All Reasons"
                width={180}
              />
              <CutoffDateRangeFilter
                mode="picker"
                cutoffPeriods={cutoffPeriods}
                selectedCutoffId={selectedCutoffId}
                onSelectCutoff={handleCutoffSelect}
              />
              <CutoffDateRangeFilter
                mode="range"
                from={pendingFrom}
                to={pendingTo}
                onFromChange={(v) => { setPendingFrom(v); setSelectedCutoffId("all"); }}
                onToChange={(v) => { setPendingTo(v); setSelectedCutoffId("all"); }}
                onApply={() => { setDateFrom(pendingFrom); setDateTo(pendingTo); }}
                isDirty={pendingFrom !== dateFrom || pendingTo !== dateTo}
              />
              {anyFilterActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contest Requests Table */}
      <Card className="border-2 shadow-md overflow-hidden">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <Building className="h-5 w-5" />
            </div>
            Contest Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-hidden">
            <div className="flex">
              <div className={`${selectedRequest ? "flex-1 min-w-0" : "w-full"} overflow-x-auto transition-all duration-200`}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {visibleCols.includes("employee") && (
                        <TableHead className="font-semibold text-center cursor-pointer" onClick={() => requestSort("employee")}>
                          <div className="flex items-center justify-center">
                            Employee
                            {sortConfig.key === "employee" && (sortConfig.direction === "ascending" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />)}
                          </div>
                        </TableHead>
                      )}
                      <TableHead className="font-semibold">Original punch</TableHead>
                      <TableHead className="font-semibold">Requested</TableHead>
                      {visibleCols.includes("status") && <TableHead className="font-semibold text-center">Status</TableHead>}
                      {visibleCols.includes("submittedAt") && (
                        <TableHead className="font-semibold text-left cursor-pointer" onClick={() => requestSort("submittedAt")}>
                          <div className="flex items-center justify-start">
                            Submitted At
                            {sortConfig.key === "submittedAt" && (sortConfig.direction === "ascending" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />)}
                          </div>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          {[...visibleCols, "punchLog", "correctTimes"].map((c) => (
                            <TableCell key={c}>
                              <Skeleton className="h-6 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredRequests.length > 0 ? (
                      <AnimatePresence>
                        {filteredRequests.map((request) => {
                          const origIn  = request.originalClockIn  || request.currentClockIn;
                          const origOut = request.originalClockOut || request.currentClockOut;
                          const isSelected = selectedRequest?.id === request.id;
                          const reqColor = requestedTimeColor(request.status);
                          const TimeBlock = ({ label, value, colorClass = "" }) => {
                            const time = formatTimeOnly(value);
                            const date = formatDateOnly(value);
                            return (
                              <div>
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
                                {time ? (
                                  <>
                                    <div className={`text-sm font-semibold ${colorClass}`}>{time}</div>
                                    <div className="text-[11px] text-muted-foreground">{date}</div>
                                  </>
                                ) : (
                                  <div className="text-sm font-medium text-red-500">Invalid date</div>
                                )}
                              </div>
                            );
                          };
                          return (
                          <motion.tr
                            key={request.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`cursor-pointer border-b transition-colors ${isSelected ? "bg-orange-50 dark:bg-orange-950/20 border-l-2 border-l-orange-500" : "hover:bg-muted/50"}`}
                            onClick={() => setSelectedRequest(request)}
                          >
                            {visibleCols.includes("employee") && (
                              <TableCell className="py-3 text-xs text-center align-middle">
                                <div className="font-medium text-sm truncate max-w-[140px] mx-auto">{request.employee.name}</div>
                              </TableCell>
                            )}
                            <TableCell className="py-3 text-xs align-top min-w-[110px]">
                              <div className="space-y-2">
                                <TimeBlock label="In" value={origIn} />
                                <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                                <TimeBlock label="Out" value={origOut} />
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-xs align-top min-w-[110px]">
                              <div className="space-y-2">
                                <TimeBlock label="In" value={request.correctClockIn} colorClass={reqColor} />
                                <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                                <TimeBlock label="Out" value={request.correctClockOut} colorClass={reqColor} />
                              </div>
                            </TableCell>
                            {visibleCols.includes("status") && (
                              <TableCell className="py-3 text-center align-top" onClick={(e) => e.stopPropagation()}>
                                {getStatusBadge(request.status)}
                              </TableCell>
                            )}
                            {visibleCols.includes("submittedAt") && (
                              <TableCell className="py-3 text-xs align-top whitespace-nowrap">
                                {fmtMMDDYYYY_hhmma(request.submittedAt)}
                              </TableCell>
                            )}
                          </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={visibleCols.length + 2} className="h-24 text-center">
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <FileText className="h-12 w-12 mb-4 text-orange-500/50" />
                        <p className="text-sm">No contest requests found.</p>
                        {anyFilterActive && (
                          <Button 
                            variant="link" 
                            onClick={clearFilters}
                            className="text-orange-600 hover:text-orange-700 mt-2"
                          >
                            Clear all filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
              </div>

              {/* ── Right: detail side panel ── */}
              <AnimatePresence>
                {selectedRequest && (() => {
                  const origIn  = selectedRequest.originalClockIn  || selectedRequest.currentClockIn;
                  const origOut = selectedRequest.originalClockOut || selectedRequest.currentClockOut;
                  const reqColor = requestedTimeColor(selectedRequest.status);
                  const hasNote = selectedRequest.detailedExplanation && selectedRequest.detailedExplanation !== "No description provided";
                  return (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="border-l bg-card flex-shrink-0 overflow-hidden"
                  >
                    <div className="w-80 h-full overflow-y-auto">
                      {/* Panel header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 sticky top-0 z-10">
                        <span className="text-sm font-semibold truncate pr-2">{selectedRequest.employee.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
                                  onClick={() => { setDeleteTarget(selectedRequest); setShowDeleteModal(true); }}
                                  disabled={actionLoading}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete request</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedRequest(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Status */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</p>
                          {getStatusBadge(selectedRequest.status)}
                        </div>

                        <div className="border-t" />

                        {/* Original punch */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Original Punch</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Clock in</span>
                              <span className="font-medium">{formatTimeOnly(origIn) ? formatDateTime(origIn) : <span className="text-red-500">Invalid date</span>}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Clock out</span>
                              <span className="font-medium">{formatTimeOnly(origOut) ? formatDateTime(origOut) : <span className="text-red-500">Invalid date</span>}</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t" />

                        {/* Requested change */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Requested Change</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Clock in</span>
                              <span className={`font-semibold ${reqColor}`}>{formatDateTime(selectedRequest.correctClockIn)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Clock out</span>
                              <span className={`font-semibold ${reqColor}`}>{formatDateTime(selectedRequest.correctClockOut)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t" />

                        {/* Reason */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reason</p>
                          <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
                            {selectedRequest.reason && selectedRequest.reason !== "N/A" ? selectedRequest.reason : <span className="italic text-muted-foreground">N/A</span>}
                          </div>
                          {hasNote && <p className="text-xs text-muted-foreground mt-2">{selectedRequest.detailedExplanation}</p>}
                        </div>

                        <div className="border-t" />

                        {/* Submitted */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Submitted</p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">At</span>
                            <span className="font-medium">{fmtMMDDYYYY_hhmma(selectedRequest.submittedAt)}</span>
                          </div>
                          {selectedRequest.approvedBy && (
                            <div className="flex items-center justify-between text-sm mt-1.5">
                              <span className="text-muted-foreground">Reviewed by</span>
                              <span className="font-medium">{selectedRequest.approvedBy}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions — approve/reject moved here from the table row */}
                        {selectedRequest.status === "pending" && (
                          <>
                            <div className="border-t" />
                            <div className="flex gap-2 pt-1">
                              <Button
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white" size="sm"
                                onClick={() => handleApproveReject(selectedRequest.id, "approved")}
                                disabled={actionLoading}
                              >
                                <Check className="h-4 w-4 mr-1.5" />Approve
                              </Button>
                              <Button
                                variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20" size="sm"
                                onClick={() => handleApproveReject(selectedRequest.id, "rejected")}
                                disabled={actionLoading}
                              >
                                <X className="h-4 w-4 mr-1.5" />Reject
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="border-2 max-w-md">
          <div className="h-1 w-full bg-red-500 -mt-4 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this contest request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="bg-muted/50 rounded-md p-3 mt-3 text-sm text-muted-foreground">
              <p>
                <strong>Employee:</strong> {deleteTarget.employee.name}
              </p>
              <p>
                <strong>Reason:</strong> {deleteTarget.reason}
              </p>
              <p>
                <strong>Submitted:</strong> {fmtMMDDYYYY_hhmma(deleteTarget.submittedAt)}
              </p>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!deleteTarget) return;
                await handleDelete(deleteTarget.id);
                setShowDeleteModal(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}