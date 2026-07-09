/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  TrashIcon,
  ChevronDown,
  ChevronUp,
  UserX,
  RefreshCw,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Download,
  Eye,
  Mail,
  Building,
  UserCog,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import IconBtn from "@/components/common/IconBtn";
import ColumnSelector from "@/components/common/ColumnSelector";
import MultiSelect from "@/components/common/MultiSelect";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { fmtMMDDYYYY_hhmma } from "@/lib/dateTimeFormatter";

const headerMap = {
  id: "Request ID",
  employeeName: "Employee Name",
  employeeEmail: "Employee Email",
  department: "Department",
  status: "Status",
  requestReason: "Reason",
  requestedAt: "Requested At",
  requestedBy: "Requested By",
  reviewedBy: "Reviewed By",
  reviewedAt: "Reviewed At",
  reviewNotes: "Review Notes",
  completedAt: "Completed At",
  createdAt: "Created At",
  updatedAt: "Updated At",
};

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function EmployeeAccountDeletion() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    id: null,
    action: "approve",
    reviewNotes: "",
  });
  const [reviewLoading, setReviewLoading] = useState(false);

  const [sortConfig, setSort] = useState({ key: "requestedAt", direction: "descending" });
  const requestSort = (k) =>
    setSort((p) => ({
      key: k,
      direction: p.key === k && p.direction === "ascending" ? "descending" : "ascending",
    }));

  const [filters, setFilters] = useState({
    ids: ["all"],
    employeeNames: ["all"],
    departments: ["all"],
    statuses: ["all"],
  });

  const columnOptions = [
    { value: "id", label: "Request ID" },
    { value: "employeeName", label: "Employee Name" },
    { value: "employeeEmail", label: "Employee Email" },
    { value: "department", label: "Department" },
    { value: "status", label: "Status" },
    { value: "requestReason", label: "Reason" },
    { value: "requestedAt", label: "Requested At" },
    { value: "requestedBy", label: "Requested By" },
    { value: "reviewedBy", label: "Reviewed By" },
    { value: "reviewedAt", label: "Reviewed At" },
    { value: "completedAt", label: "Completed At" },
    { value: "createdAt", label: "Created At" },
    { value: "updatedAt", label: "Updated At" },
    { value: "actions", label: "Actions" },
  ];
  const [visibleCols, setVisibleCols] = useState([
    "id",
    "employeeName",
    "department",
    "status",
    "requestedAt",
    "actions"
  ]);

  useEffect(() => {
    if (!token) return;
    fetchRequests();
  }, [token]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/account-deletion/get-request`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (response.ok) {
        const transformedData = (json.data || []).map((request) => ({
          ...request,
          employeeName: request.user?.profile
            ? `${request.user.profile.firstName || ""} ${request.user.profile.lastName || ""}`.trim()
            : "Unknown",
          employeeEmail: request.user?.email || "N/A",
          departmentName: request.department?.name || "No Department",
          requestedByName: request.requestedByUser?.profile
            ? `${request.requestedByUser.profile.firstName || ""} ${request.requestedByUser.profile.lastName || ""}`.trim()
            : request.requestedByUser?.email || "Unknown",
          reviewedByName: request.reviewedByUser?.profile
            ? `${request.reviewedByUser.profile.firstName || ""} ${request.reviewedByUser.profile.lastName || ""}`.trim()
            : request.reviewedByUser?.email || null,
        }));
        
        setRequests(transformedData);
      } else {
        toast.error(json.error || "Failed to fetch deletion requests");
      }
    } catch (error) {
      toast.error("Failed to fetch deletion requests");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchRequests();
    toast.message("Data refreshed");
    setRefreshing(false);
  };

  const StatusBadge = ({ status }) => {
    const badges = {
      pending: <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>,
      approved: <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
        <CheckCircle className="h-3 w-3 mr-1" />
        Approved
      </Badge>,
      rejected: <Badge className="bg-red-500 hover:bg-red-600 text-white">
        <XCircle className="h-3 w-3 mr-1" />
        Rejected
      </Badge>,
      completed: <Badge className="bg-green-500 hover:bg-green-600 text-white">
        <CheckCircle className="h-3 w-3 mr-1" />
        Completed
      </Badge>,
    };
    return badges[status.toLowerCase()] || <Badge>{status}</Badge>;
  };

  const idOpts = requests.map((r) => ({ value: r.id, label: r.id }));

  const nameOpts = [...new Set(requests.map((r) => r.employeeName).filter(Boolean))].map((name) => ({
    value: name.toLowerCase(),
    label: name,
  }));
  
  const deptOpts = [...new Set(requests.map((r) => r.departmentName).filter(Boolean))].map((dept) => ({
    value: dept.toLowerCase(),
    label: dept,
  }));
  
  const statusOpts = ["pending", "approved", "rejected", "completed"].map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
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

  const clearFilters = () =>
    setFilters({
      ids: ["all"],
      employeeNames: ["all"],
      departments: ["all"],
      statuses: ["all"],
    });

  const anyFilterActive =
    !filters.ids.includes("all") ||
    !filters.employeeNames.includes("all") ||
    !filters.departments.includes("all") ||
    !filters.statuses.includes("all");

  const list = useMemo(() => {
    const filtered = requests.filter((r) => {
      return (
        (filters.ids.includes("all") || filters.ids.includes(r.id)) &&
        (filters.employeeNames.includes("all") || filters.employeeNames.includes(r.employeeName.toLowerCase())) &&
        (filters.departments.includes("all") || filters.departments.includes(r.departmentName.toLowerCase())) &&
        (filters.statuses.includes("all") || filters.statuses.includes(r.status.toLowerCase()))
      );
    });

    if (!sortConfig.key) return filtered;

    const getVal = (req, key) => {
      switch (key) {
        case "id":
          return req.id;
        case "employeeName":
          return req.employeeName.toLowerCase();
        case "employeeEmail":
          return req.employeeEmail.toLowerCase();
        case "department":
          return req.departmentName.toLowerCase();
        case "status":
          return req.status.toLowerCase();
        case "requestReason":
          return (req.requestReason || "").toLowerCase();
        case "requestedAt":
        case "reviewedAt":
        case "completedAt":
        case "createdAt":
        case "updatedAt":
          return req[key] ? new Date(req[key]).getTime() : 0;
        case "requestedBy":
          return req.requestedByName.toLowerCase();
        case "reviewedBy":
          return (req.reviewedByName || "").toLowerCase();
        default:
          return "";
      }
    };

    return [...filtered].sort((a, b) => {
      const aVal = getVal(a, sortConfig.key);
      const bVal = getVal(b, sortConfig.key);
      if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
  }, [requests, filters, sortConfig]);

  const openView = (request) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const openReview = (request) => {
    setReviewForm({
      id: request.id,
      action: "approve",
      reviewNotes: "",
    });
    setShowReviewModal(true);
  };

  const handleReview = async () => {
    if (!reviewForm.reviewNotes.trim()) {
      return toast.error("Please provide review notes");
    }

    setReviewLoading(true);
    // Simulating API call
    setTimeout(() => {
      toast.success(
        reviewForm.action === "approve"
          ? "Deletion request approved"
          : "Deletion request rejected"
      );
      setShowReviewModal(false);
      fetchRequests();
      setReviewLoading(false);
    }, 1000);
  };

  const buildCSV = () => {
    const head = visibleCols.filter((c) => c !== "actions").map((c) => `"${headerMap[c]}"`);
    const body = list.map((r) => {
      const rowMap = {
        id: r.id,
        employeeName: r.employeeName,
        employeeEmail: r.employeeEmail,
        department: r.departmentName,
        status: r.status,
        requestReason: r.requestReason || "",
        requestedAt: fmt(r.requestedAt),
        requestedBy: r.requestedByName,
        reviewedBy: r.reviewedByName || "",
        reviewedAt: fmt(r.reviewedAt),
        reviewNotes: r.reviewNotes || "",
        completedAt: fmt(r.completedAt),
        createdAt: fmt(r.createdAt),
        updatedAt: fmt(r.updatedAt),
      };
      return visibleCols
        .filter((k) => k !== "actions")
        .map((k) => `"${rowMap[k] ?? ""}"`)
        .join(",");
    });
    return [head, ...body].join("\r\n");
  };

  const exportCSV = async () => {
    if (!list.length) {
      toast.message("No data to export");
      return;
    }
    
    setExporting(true);
    
    try {
      const { exportDeletionRequestsCSV } = await import("@/lib/exports/deletionRequests");
      const result = await exportDeletionRequestsCSV({
        data: list,
        visibleColumns: visibleCols,
        columnMap: headerMap,
      });
      
      if (result.success) {
        toast.success(`${result.filename}`);
      }
    } catch (error) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    if (!list.length) {
      toast.message("No data to export");
      return;
    }
    
    setPdfExporting(true);
    
    try {
      const { exportDeletionRequestsPDF } = await import("@/lib/exports/deletionRequests");
      const result = await exportDeletionRequestsPDF({
        data: list,
        visibleColumns: visibleCols,
        columnMap: headerMap,
      });
      
      if (result.success) {
        toast.success(`${result.filename}`);
      }
    } catch (error) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <div className="max-w-full mx-auto p-4 lg:px-10 space-y-8">
      <Toaster position="top-center" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <UserX className="h-7 w-7 text-orange-500" />
            Employee Account Deletion Requests
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage employee account deletion requests
          </p>
        </div>
        <div className="flex gap-2">
          <IconBtn icon={RefreshCw} tooltip="Refresh table" spinning={refreshing} onClick={refreshData} />
          <IconBtn icon={Download} tooltip="Export CSV" spinning={exporting} onClick={exportCSV} disabled={!list.length} />
          <IconBtn icon={FileText} tooltip="Export PDF" spinning={pdfExporting} onClick={exportPDF} disabled={!list.length} />
        </div>
      </div>

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
            {list.length} of {requests.length}
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
                options={idOpts}
                selected={filters.ids}
                onChange={(v) => changeFilter("ids", v)}
                allLabel="All Request IDs"
                width={180}
              />
              <MultiSelect
                options={nameOpts}
                selected={filters.employeeNames}
                onChange={(v) => changeFilter("employeeNames", v)}
                allLabel="All Employees"
                icon={UserCog}
                width={180}
              />
              <MultiSelect
                options={deptOpts}
                selected={filters.departments}
                onChange={(v) => changeFilter("departments", v)}
                allLabel="All Departments"
                icon={Building}
                width={180}
              />
              <MultiSelect
                options={statusOpts}
                selected={filters.statuses}
                onChange={(v) => changeFilter("statuses", v)}
                allLabel="All Statuses"
                width={150}
              />
              {anyFilterActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="border-orange-500/30 text-orange-700 hover:bg-orange-500/10"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-md overflow-hidden">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <Building className="h-5 w-5" />
            </div>
            Deletion Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnOptions
                    .filter((o) => o.value !== "actions" && visibleCols.includes(o.value))
                    .map(({ value, label }) => (
                      <TableHead key={value} className="text-center cursor-pointer" onClick={() => requestSort(value)}>
                        <div className="flex items-center justify-center">
                          {label}
                          {sortConfig.key === value &&
                            (sortConfig.direction === "ascending" ? (
                              <ChevronUp className="h-4 w-4 ml-1" />
                            ) : (
                              <ChevronDown className="h-4 w-4 ml-1" />
                            ))}
                        </div>
                      </TableHead>
                    ))}
                  {visibleCols.includes("actions") && <TableHead className="text-center">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {visibleCols.map((c) => (
                        <TableCell key={c}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : list.length ? (
                  <AnimatePresence>
                    {list.map((r) => (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-b hover:bg-muted/50"
                      >
                        {visibleCols.includes("id") && (
                          <TableCell className="text-center text-xs text-nowrap">{r.id}</TableCell>
                        )}
                        {visibleCols.includes("employeeName") && (
                          <TableCell className="text-center text-xs text-nowrap">{r.employeeName}</TableCell>
                        )}
                        {visibleCols.includes("employeeEmail") && (
                          <TableCell className="text-center text-xs text-nowrap">{r.employeeEmail}</TableCell>
                        )}
                        {visibleCols.includes("department") && (
                          <TableCell className="text-center text-xs text-nowrap">{r.departmentName}</TableCell>
                        )}
                        {visibleCols.includes("status") && (
                          <TableCell className="text-center text-nowrap">
                            <StatusBadge status={r.status} />
                          </TableCell>
                        )}
                        {visibleCols.includes("requestReason") && (
                          <TableCell className="text-center text-xs max-w-xs truncate">{r.requestReason || "—"}</TableCell>
                        )}
                        {visibleCols.includes("requestedAt") && (
                          <TableCell className="text-center text-xs text-nowrap">{fmtMMDDYYYY_hhmma(r.requestedAt)}</TableCell>
                        )}
                        {visibleCols.includes("requestedBy") && (
                          <TableCell className="text-center text-xs text-nowrap">{r.requestedByName}</TableCell>
                        )}
                        {visibleCols.includes("reviewedBy") && (
                          <TableCell className="text-center text-xs text-nowrap">{r.reviewedByName || "—"}</TableCell>
                        )}
                        {visibleCols.includes("reviewedAt") && (
                          <TableCell className="text-center text-xs text-nowrap">
                            {r.reviewedAt ? fmtMMDDYYYY_hhmma(r.reviewedAt) : "—"}
                          </TableCell>
                        )}
                        {visibleCols.includes("completedAt") && (
                          <TableCell className="text-center text-xs text-nowrap">
                            {r.completedAt ? fmtMMDDYYYY_hhmma(r.completedAt) : "—"}
                          </TableCell>
                        )}
                        {visibleCols.includes("createdAt") && (
                          <TableCell className="text-center text-xs text-nowrap">{fmtMMDDYYYY_hhmma(r.createdAt)}</TableCell>
                        )}
                        {visibleCols.includes("updatedAt") && (
                          <TableCell className="text-center text-xs text-nowrap">{fmtMMDDYYYY_hhmma(r.updatedAt)}</TableCell>
                        )}
                        {visibleCols.includes("actions") && (
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openView(r)}
                                      className="text-blue-500 hover:bg-blue-500/10"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View details</TooltipContent>
                                </Tooltip>
                                {r.status === "pending" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openReview(r)}
                                        className="text-orange-500 hover:bg-orange-500/10"
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Review request</TooltipContent>
                                  </Tooltip>
                                )}
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                ) : (
                  <TableRow>
                    <TableCell colSpan={visibleCols.length} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <div className="w-16 h-16 bg-neutral-200/5 rounded-full flex items-center justify-center mx-auto mb-4">
                          <UserX className="h-8 w-8 text-orange-500/50" />
                        </div>
                        <p className="text-sm">No deletion requests found.</p>
                        {anyFilterActive && (
                          <Button variant="link" onClick={clearFilters} className="text-orange-600 hover:text-orange-700 mt-2">
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
        </CardContent>
      </Card>

      {/* View Details Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="border-2 max-w-2xl">
          <div className="h-1 w-full bg-orange-500 -mt-4 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-200/25 text-orange-500">
                <Eye className="h-5 w-5" />
              </div>
              Deletion Request Details
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Request ID</label>
                    <p className="text-sm">{selectedRequest.id}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <StatusBadge status={selectedRequest.status} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Employee Name</label>
                    <p className="text-sm">{selectedRequest.employeeName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Employee Email</label>
                    <p className="text-sm">{selectedRequest.employeeEmail}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Department</label>
                    <p className="text-sm">{selectedRequest.departmentName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Requested At</label>
                    <p className="text-sm">{fmtMMDDYYYY_hhmma(selectedRequest.requestedAt)}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Requested By</label>
                  <p className="text-sm">{selectedRequest.requestedByName}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Request Reason</label>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.requestReason || "No reason provided"}</p>
                </div>

                {selectedRequest.reviewedBy && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Reviewed By</label>
                        <p className="text-sm">{selectedRequest.reviewedByName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Reviewed At</label>
                        <p className="text-sm">{fmtMMDDYYYY_hhmma(selectedRequest.reviewedAt)}</p>
                      </div>
                    </div>

                    {selectedRequest.reviewNotes && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Review Notes</label>
                        <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.reviewNotes}</p>
                      </div>
                    )}
                  </>
                )}

                {selectedRequest.completedAt && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Completed At</label>
                    <p className="text-sm">{fmtMMDDYYYY_hhmma(selectedRequest.completedAt)}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Created At</label>
                    <p className="text-sm">{fmtMMDDYYYY_hhmma(selectedRequest.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Last Updated</label>
                    <p className="text-sm">{fmtMMDDYYYY_hhmma(selectedRequest.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewModal(false)} className="bg-orange-500 text-white">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="border-2 max-w-md">
          <div className="h-1 w-full bg-orange-500 -mt-4 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-200/25 text-orange-500">
                <CheckCircle className="h-5 w-5" />
              </div>
              Review Deletion Request
            </DialogTitle>
            <DialogDescription>
              Approve or reject this account deletion request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <div className="flex gap-2">
                <Button
                  variant={reviewForm.action === "approve" ? "default" : "outline"}
                  className={reviewForm.action === "approve" ? "bg-green-500 hover:bg-green-600" : ""}
                  onClick={() => setReviewForm({ ...reviewForm, action: "approve" })}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant={reviewForm.action === "reject" ? "default" : "outline"}
                  className={reviewForm.action === "reject" ? "bg-red-500 hover:bg-red-600" : ""}
                  onClick={() => setReviewForm({ ...reviewForm, action: "reject" })}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Review Notes *</label>
              <Textarea
                placeholder="Provide detailed notes about your decision..."
                value={reviewForm.reviewNotes}
                onChange={(e) => setReviewForm({ ...reviewForm, reviewNotes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewLoading}
              className={reviewForm.action === "approve" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}
            >
              {reviewLoading ? "Processing..." : reviewForm.action === "approve" ? "Approve Request" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}