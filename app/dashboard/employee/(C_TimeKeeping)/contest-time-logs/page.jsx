"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import useAuthStore from "@/store/useAuthStore";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, 
  RefreshCw, 
  Timer, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Filter,
  Download,
  FileText,
  Calendar,
  TrendingUp,
  Activity,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

function StatusBadge({ status }) {
  const statusConfig = {
    pending: {
      variant: "secondary",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      icon: AlertCircle,
      label: "Pending"
    },
    approved: {
      variant: "secondary",
      className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      icon: CheckCircle2,
      label: "Approved"
    },
    rejected: {
      variant: "secondary",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      icon: XCircle,
      label: "Rejected"
    }
  };

  const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`${config.className} flex items-center gap-1 w-fit`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function TableRowSkeleton() {
  return (
    <TableRow>
      {[...Array(8)].map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-8 w-full" />
        </TableCell>
      ))}
    </TableRow>
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
  const [expandedRow, setExpandedRow] = useState(null);

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
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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

  // Filter and search logic
  const filteredLogs = useMemo(() => {
    let filtered = [...contestLogs];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(log => log.status?.toLowerCase() === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.reason?.toLowerCase().includes(query) ||
        log.id?.toString().includes(query)
      );
    }

    // Date range filter
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

  // Stats calculations
  const stats = useMemo(() => {
    const total = contestLogs.length;
    const pending = contestLogs.filter(log => log.status?.toLowerCase() === "pending").length;
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

  return (
    <TooltipProvider>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Toaster position="top-center" richColors />
        
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg">
                <Activity className="h-6 w-6" />
              </div>
              Contest Time Logs
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View and track your time contest requests
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href="/dashboard/employee/punch">
                <Clock className="h-4 w-4" />
                Punch
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href="/dashboard/employee/punch-logs">
                <Timer className="h-4 w-4" />
                Logs
              </Link>
            </Button>
            <Button
              onClick={fetchContestLogs}
              variant="outline"
              size="sm"
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={filteredLogs.length === 0}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={exportToPDF}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={filteredLogs.length === 0}
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </motion.div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
              <div className="h-1 w-full bg-orange-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Contests
                  </CardTitle>
                  <FileText className="h-4 w-4 text-orange-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {stats.total}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  All time requests
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
              <div className="h-1 w-full bg-yellow-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Pending
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Awaiting review
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
              <div className="h-1 w-full bg-green-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Approved
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.approved}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Accepted requests
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
              <div className="h-1 w-full bg-red-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Rejected
                  </CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats.rejected}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Declined requests
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filters and Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-2 shadow-lg">
            <div className="h-1 w-full bg-orange-500" />
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-orange-500" />
                    Contest Logs
                  </CardTitle>
                  <CardDescription>
                    Filter and view your contest time requests
                  </CardDescription>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {filteredLogs.length} of {contestLogs.length} entries
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter Controls */}
              <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search by reason or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full md:w-[150px]"
                  placeholder="From date"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full md:w-[150px]"
                  placeholder="To date"
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900">
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">Contest Date</TableHead>
                      <TableHead className="font-semibold">Time In</TableHead>
                      <TableHead className="font-semibold">Time Out</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Reason</TableHead>
                      <TableHead className="font-semibold">Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => <TableRowSkeleton key={i} />)
                    ) : filteredLogs.length > 0 ? (
                      <AnimatePresence>
                        {filteredLogs.map((log, index) => (
                          <ContestLogRow
                            key={log.id}
                            log={log}
                            index={index}
                            expanded={expandedRow === log.id}
                            onToggleExpand={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                          />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                              <FileText className="h-6 w-6 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                              No contest logs found
                            </p>
                            <p className="text-xs text-gray-500">
                              {statusFilter !== "all" || searchQuery || dateFrom || dateTo
                                ? "Try adjusting your filters"
                                : "Submit a contest request to see it here"
                              }
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}

// Expandable Contest Log Row Component
function ContestLogRow({ log, index, expanded, onToggleExpand }) {
  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/20 cursor-pointer group transition-colors"
        onClick={onToggleExpand}
      >
        <TableCell className="w-12">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </Button>
        </TableCell>
        <TableCell className="font-mono text-sm">
          #{log.id}
        </TableCell>
        <TableCell className="font-mono">
          {log.requestedClockIn 
            ? format(parseISO(log.requestedClockIn), "MMM d, yyyy")
            : "N/A"
          }
        </TableCell>
        <TableCell className="font-mono">
        {log.requestedClockIn
            ? format(parseISO(log.requestedClockIn), "MMM d, yyyy hh:mm a")
            : "N/A"}
        </TableCell>
        <TableCell className="font-mono">
        {log.requestedClockOut
            ? format(parseISO(log.requestedClockOut), "MMM d, yyyy hh:mm a")
            : "N/A"}
        </TableCell>
        <TableCell>
          <StatusBadge status={log.status} />
        </TableCell>
        <TableCell className="max-w-xs truncate">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                {log.reason || "No reason provided"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{log.reason || "No reason provided"}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="font-mono text-sm">
          {format(parseISO(log.createdAt), "MMM d, yyyy HH:mm")}
        </TableCell>
      </motion.tr>
      
      {expanded && (
        <motion.tr
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="bg-gray-50 dark:bg-gray-900/50"
        >
          <TableCell colSpan={8} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Time Details Section */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  Original vs Requested Times
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-md border">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Original Clock In:</span>
                      <span className="font-medium font-mono">{log.currentClockIn ? format(parseISO(log.currentClockIn), "MMM d, yyyy HH:mm") : "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600 dark:text-green-400">Requested Clock In:</span>
                      <span className="font-medium font-mono text-green-600 dark:text-green-400">{log.requestedClockIn ? format(parseISO(log.requestedClockIn), "MMM d, yyyy HH:mm") : "N/A"}</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-md border">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Original Clock Out:</span>
                      <span className="font-medium font-mono">{log.currentClockOut ? format(parseISO(log.currentClockOut), "MMM d, yyyy HH:mm") : "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600 dark:text-green-400">Requested Clock Out:</span>
                      <span className="font-medium font-mono text-green-600 dark:text-green-400">{log.requestedClockOut ? format(parseISO(log.requestedClockOut), "MMM d, yyyy HH:mm") : "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Request Details Section */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  Request Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-md border">
                    <div className="mb-2">
                      <span className="text-gray-600 dark:text-gray-400 block mb-1">Status:</span>
                      <StatusBadge status={log.status} />
                    </div>
                    <div className="mb-2">
                      <span className="text-gray-600 dark:text-gray-400 block mb-1">Reason:</span>
                      <span className="font-medium">{log.reason || "N/A"}</span>
                    </div>
                    {log.description && (
                      <div className="mb-2">
                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Description:</span>
                        <p className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded border max-h-24 overflow-y-auto">
                          {log.description}
                        </p>
                      </div>
                    )}
                    {log.approverName && (
                      <div className="mb-2">
                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Approver:</span>
                        <span className="font-medium">{log.approverName}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 block mb-1">Submitted:</span>
                      <span className="font-medium font-mono text-xs">
                        {format(parseISO(log.createdAt), "MMM d, yyyy 'at' HH:mm:ss")}
                      </span>
                    </div>
                    {log.reviewedAt && (
                      <div className="mt-2">
                        <span className="text-gray-600 dark:text-gray-400 block mb-1">Reviewed:</span>
                        <span className="font-medium font-mono text-xs">
                          {format(parseISO(log.reviewedAt), "MMM d, yyyy 'at' HH:mm:ss")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Time Log ID Reference */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Time Log Reference: #{log.timeLogId || "N/A"}</span>
                <span>Contest ID: #{log.id}</span>
              </div>
            </div>
          </TableCell>
        </motion.tr>
      )}
    </>
  );
}