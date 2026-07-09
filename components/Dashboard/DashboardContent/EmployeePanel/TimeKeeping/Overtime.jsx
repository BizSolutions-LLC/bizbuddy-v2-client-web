/* components/Dashboard/DashboardContent/TimeKeeping/Overtime.jsx */
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Clock,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  FileText,
  ChevronsLeft,
  ChevronsRight,
  User,
  CheckCircle,
  XCircle,
  Hourglass,
  TrendingUp,
  Eye,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import IconBtn from "@/components/common/IconBtn";
import TableSkeleton from "@/components/common/TableSkeleton";

const safeDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

const safeTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const safeDateTime = (d) => (d ? `${safeDate(d)} ${safeTime(d)}` : "—");

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400";
  }
};

const getStatusIcon = (status) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return <Hourglass className="h-3 w-3" />;
    case "approved":
      return <CheckCircle className="h-3 w-3" />;
    case "rejected":
      return <XCircle className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
};

export default function Overtime() {
  const { token, user } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Data states
  const [overtimeRequests, setOvertimeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Detail dialog states
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Table states
  const [filters, setFilters] = useState({
    status: "all",
    from: "",
    to: "",
  });
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "descending",
  });

  // Pagination
  const defaultRowsPerPage = 10;
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOvertimeRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/overtime/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.ok) {
        setOvertimeRequests(j.data || []);
      } else {
        throw new Error(j.message || "Failed to fetch overtime requests");
      }
    } catch (err) {
      console.error("Error fetching overtime requests:", err);
      toast.message(err.message || "Failed to load overtime requests");
      setOvertimeRequests([]); // Set empty array on error
    }
  }, [API_URL, token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchOvertimeRequests().finally(() => setLoading(false));
  }, [token, fetchOvertimeRequests]);

  const refresh = () => {
    setRefreshing(true);
    fetchOvertimeRequests().finally(() => setRefreshing(false));
  };

  // Statistics
  const stats = useMemo(() => {
    const total = overtimeRequests.length;
    const pending = overtimeRequests.filter(r => r.status?.toLowerCase() === "pending").length;
    const approved = overtimeRequests.filter(r => r.status?.toLowerCase() === "approved").length;
    const rejected = overtimeRequests.filter(r => r.status?.toLowerCase() === "rejected").length;
    const totalHours = overtimeRequests
      .filter(r => r.status?.toLowerCase() === "approved")
      .reduce((sum, r) => sum + (parseFloat(r.requestedHours) || 0), 0);
    
    return { total, pending, approved, rejected, totalHours };
  }, [overtimeRequests]);

  // Filtering and sorting
  const filteredSorted = useMemo(() => {
    let data = [...overtimeRequests];
    
    if (filters.status !== "all") {
      data = data.filter(req => req.status?.toLowerCase() === filters.status);
    }
    if (filters.from) {
      data = data.filter(req => req.createdAt?.slice(0, 10) >= filters.from);
    }
    if (filters.to) {
      data = data.filter(req => req.createdAt?.slice(0, 10) <= filters.to);
    }

    data.sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case "requestedHours":
          aVal = parseFloat(a.requestedHours) || 0;
          bVal = parseFloat(b.requestedHours) || 0;
          break;
        case "status":
          aVal = (a.status || "").toLowerCase();
          bVal = (b.status || "").toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });

    return data;
  }, [overtimeRequests, filters, sortConfig]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(filteredSorted.length / rowsPerPage));
    setTotalPages(tp);
    if (page > tp) setPage(tp);
  }, [filteredSorted, rowsPerPage, page]);

  const displayed = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredSorted.slice(start, start + rowsPerPage);
  }, [filteredSorted, page, rowsPerPage]);

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "ascending" ? "descending" : "ascending",
    }));
  };

  const exportCSV = () => {
    if (!filteredSorted.length) {
      toast.message("No data to export");
      return;
    }
    
    setExporting(true);
    const headers = ["Date Submitted", "TimeLog ID", "Requested Hours", "Status", "Approver", "Reason"].join(",");
    const rows = filteredSorted.map(req => [
      safeDateTime(req.createdAt),
      req.timeLogId || "—",
      req.requestedHours || "0",
      req.status || "—",
      req.approver?.profile?.firstName && req.approver?.profile?.lastName 
        ? `${req.approver.profile.firstName} ${req.approver.profile.lastName}`
        : req.approver?.email || "—",
      `"${(req.requesterReason || "").replace(/"/g, '""')}"`
    ].join(","));
    
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Overtime_Requests_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("CSV exported successfully");
    setExporting(false);
  };

  const exportPDF = async () => {
    if (!filteredSorted.length) {
      toast.message("No data to export");
      return;
    }

    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const company = user?.company?.name || "—";
    const fullName = `${user?.profile?.firstName || ""} ${user?.profile?.lastName || ""}`.trim() || "—";
    const email = user?.email || "—";

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(12);
    doc.text(`Company: ${company}`, 14, 20);
    doc.text(`Employee: ${fullName}`, 14, 28);
    doc.text(`Email: ${email}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 44);

    const tableHead = [["Date Submitted", "TimeLog ID", "Hours", "Status", "Approver", "Reason"]];
    const tableBody = filteredSorted.map(req => [
      safeDateTime(req.createdAt),
      req.timeLogId || "—",
      req.requestedHours || "0",
      req.status || "—",
      req.approver?.profile?.firstName && req.approver?.profile?.lastName
        ? `${req.approver.profile.firstName} ${req.approver.profile.lastName}`
        : req.approver?.email || "—",
      (req.requesterReason || "").substring(0, 40) + (req.requesterReason?.length > 40 ? "..." : "")
    ]);

    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: 52,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 165, 0] },
    });

    doc.save(`Overtime_Requests_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.message("PDF exported successfully");
  };

  const viewDetails = (request) => {
    setSelectedRequest(request);
    setDetailDialogOpen(true);
  };

  return (
    <div className="max-w-full mx-auto p-4 lg:px-4 px-1 space-y-8">
      <Toaster position="top-center" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-500" />
            Overtime Requests
          </h2>
          <p className="text-muted-foreground mt-1">View and track your overtime request history</p>
        </div>
        <div className="flex gap-2">
          <IconBtn icon={RefreshCw} tooltip="Refresh" spinning={refreshing} onClick={refresh} />
          <IconBtn icon={Download} tooltip="Export CSV" spinning={exporting} onClick={exportCSV} />
          <IconBtn icon={FileText} tooltip="Export PDF" onClick={exportPDF} />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 dark:border-white/10">
          <div className="h-1 w-full bg-blue-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-2 dark:border-white/10">
          <div className="h-1 w-full bg-yellow-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-yellow-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card className="border-2 dark:border-white/10">
          <div className="h-1 w-full bg-green-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card className="border-2 dark:border-white/10">
          <div className="h-1 w-full bg-orange-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              Approved Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-orange-500" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">From:</span>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
                className="h-8"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">To:</span>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value }))}
                className="h-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overtime Requests Table */}
      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Overtime Requests
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {displayed.length} of {filteredSorted.length} requests
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => requestSort("createdAt")}>
                    <div className="flex items-center">
                      Date Submitted
                      {sortConfig.key === "createdAt" && (
                        sortConfig.direction === "ascending" ? 
                        <ChevronUp className="h-4 w-4 ml-1" /> : 
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>TimeLog ID</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort("requestedHours")}>
                    <div className="flex items-center">
                      Hours Requested
                      {sortConfig.key === "requestedHours" && (
                        sortConfig.direction === "ascending" ? 
                        <ChevronUp className="h-4 w-4 ml-1" /> : 
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort("status")}>
                    <div className="flex items-center">
                      Status
                      {sortConfig.key === "status" && (
                        sortConfig.direction === "ascending" ? 
                        <ChevronUp className="h-4 w-4 ml-1" /> : 
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Approver</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={6} cols={7} />
                ) : displayed.length ? (
                  <AnimatePresence>
                    {displayed.map((request) => (
                      <motion.tr
                        key={request.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-b hover:bg-muted/50"
                      >
                        <TableCell className="text-sm">
                          {safeDateTime(request.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {request.timeLogId || "—"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {request.requestedHours || "0"} hrs
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(request.status)} flex items-center gap-1 w-fit`}>
                            {getStatusIcon(request.status)}
                            {request.status || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {request.approver?.profile?.firstName && request.approver?.profile?.lastName 
                            ? `${request.approver.profile.firstName} ${request.approver.profile.lastName}`
                            : request.approver?.email || "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {request.requesterReason || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetails(request)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Clock className="h-8 w-8 mb-2 opacity-50" />
                        <p className="font-medium">No overtime requests found</p>
                        <p className="text-sm">Overtime requests created from punch logs will appear here</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* Pagination */}
        {filteredSorted.length > defaultRowsPerPage && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="flex gap-1" disabled={page === 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="h-4 w-4" />
                First
              </Button>
              {[...Array(totalPages)].map((_, i) => {
                const p = i + 1;
                if (p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  return (
                    <Button key={p} size="sm" variant={p === page ? "default" : "outline"} onClick={() => setPage(p)}>
                      {p}
                    </Button>
                  );
                if ((p === page - 2 && p > 1) || (p === page + 2 && p < totalPages))
                  return (
                    <span key={p} className="px-1 text-muted-foreground">
                      …
                    </span>
                  );
                return null;
              })}
              <Button
                size="sm"
                variant="outline"
                className="flex gap-1"
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
              >
                Last
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {rowsPerPage < filteredSorted.length && (
                <Button
                  size="sm"
                  onClick={() => {
                    const next = Math.min(rowsPerPage + defaultRowsPerPage, filteredSorted.length);
                    setRowsPerPage(next);
                  }}
                >
                  Load more
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg border-2 dark:border-white/30">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-orange-600" />
              Overtime Request Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Request ID</label>
                  <p className="text-sm font-mono">{selectedRequest.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">TimeLog ID</label>
                  <p className="text-sm font-mono">{selectedRequest.timeLogId}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Requested Hours</label>
                  <p className="text-sm font-medium">{selectedRequest.requestedHours} hours</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={`${getStatusColor(selectedRequest.status)} flex items-center gap-1 w-fit mt-1`}>
                    {getStatusIcon(selectedRequest.status)}
                    {selectedRequest.status}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                  <p className="text-sm">{safeDateTime(selectedRequest.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-sm">{safeDateTime(selectedRequest.updatedAt)}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Approver</label>
                <p className="text-sm">
                  {selectedRequest.approver?.profile?.firstName && selectedRequest.approver?.profile?.lastName 
                    ? `${selectedRequest.approver.profile.firstName} ${selectedRequest.approver.profile.lastName}`
                    : selectedRequest.approver?.email || "Not assigned"}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Reason</label>
                <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.requesterReason || "No reason provided"}</p>
              </div>
              
              {selectedRequest.approverComments && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Approver Comments</label>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.approverComments}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setDetailDialogOpen(false)} className="bg-orange-500 hover:bg-orange-600 text-white">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}