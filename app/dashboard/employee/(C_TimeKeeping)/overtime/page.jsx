
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  TrendingUp,
  AlertCircle,
  User,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import DataTable from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
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

export default function EmployeeOvertimeRequests() {
  const { token, user } = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [detailDialog, setDetailDialog] = useState({ open: false, request: null });

  // Calculate stats
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === "pending").length;
    const approved = requests.filter(r => r.status === "approved").length;
    const rejected = requests.filter(r => r.status === "rejected").length;
    const approvedHours = requests
      .filter(r => r.status === "approved")
      .reduce((sum, r) => sum + Number(r.requestedHours || 0), 0);

    return { total, pending, approved, rejected, approvedHours: approvedHours.toFixed(1) };
  }, [requests]);

  // Status tabs for the table
  const statusTabs = useMemo(() => [
    { label: "All", value: "all", count: stats.total },
    { label: "Pending", value: "pending", count: stats.pending },
    { label: "Approved", value: "approved", count: stats.approved },
    { label: "Rejected", value: "rejected", count: stats.rejected },
  ], [requests, stats]);

  // Table columns
  const columns = [
    {
      key: "createdAt",
      label: "Date Submitted",
      render: (date) => (
        <div className="text-sm">
          <div className="font-medium">{new Date(date).toLocaleDateString()}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      key: "requestedHours",
      label: "Hours Requested",
      render: (hours) => (
        <div className="font-mono text-sm font-medium">
          {Number(hours).toFixed(2)}h
        </div>
      ),
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (status) => <StatusBadge status={status} />,
      sortable: true,
    },
    {
      key: "approver",
      label: "Approver",
      render: (_, row) => (
        <div className="text-sm">
          {row.approver?.email || "Not assigned"}
        </div>
      ),
    },
    {
      key: "requesterReason",
      label: "Reason",
      render: (reason) => (
        <div className="max-w-32 truncate text-sm text-muted-foreground">
          {reason || "No reason provided"}
        </div>
      ),
    },
    {
      key: "updatedAt",
      label: "Last Updated",
      render: (date) => (
        <div className="text-sm text-muted-foreground">
          {new Date(date).toLocaleDateString()}
        </div>
      ),
      sortable: true,
    },
  ];

  // Table actions
  const actions = [
    {
      label: "View Details",
      icon: Eye,
      onClick: (request) => setDetailDialog({ open: true, request }),
    },
  ];

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/overtime/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Failed to fetch overtime requests");
      
      setRequests(data.data || []);
    } catch (error) {
      toast.error(error.message || "Failed to fetch overtime requests");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const getProjectedTime = (request) => {
    if (!request.timeLog?.timeOut || !request.requestedHours) return null;
    const originalOut = new Date(request.timeLog.timeOut);
    const withOT = new Date(originalOut.getTime() + Number(request.requestedHours) * 3600000);
    return withOT;
  };

  const getTotalHours = (request) => {
    if (!request.timeLog?.timeIn || !request.timeLog?.timeOut || !request.requestedHours) return null;
    const projected = getProjectedTime(request);
    if (!projected) return null;
    const hours = (projected - new Date(request.timeLog.timeIn)) / 3600000;
    return hours.toFixed(2);
  };

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overtime Requests</h1>
          <p className="text-muted-foreground">View and track your overtime request history</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
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
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
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
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Hours</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.approvedHours}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <CardTitle>Overtime Requests</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            data={requests}
            columns={columns}
            loading={loading}
            onRefresh={fetchRequests}
            actions={actions}
            searchPlaceholder="Search by reason, status, or date..."
            statusTabs={statusTabs}
            onRowClick={(request) => setDetailDialog({ open: true, request })}
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, request: null })}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 flex-shrink-0" />
              <span className="truncate">Overtime Request Details</span>
            </DialogTitle>
          </DialogHeader>

          {detailDialog.request && (
            <div className="space-y-4 sm:space-y-6">
              {/* Status and Hours - Responsive Layout */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b">
                <StatusBadge status={detailDialog.request.status} />
                <div className="text-right w-full sm:w-auto">
                  <div className="text-xl sm:text-2xl font-bold text-orange-600">
                    {Number(detailDialog.request.requestedHours).toFixed(2)}h
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Overtime Hours</div>
                </div>
              </div>

              {/* Request Info - Improved Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">Request ID</div>
                  <div className="font-mono text-xs break-all bg-muted/50 p-2 rounded">
                    {detailDialog.request.id}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">TimeLog ID</div>
                  <div className="font-mono text-xs break-all bg-muted/50 p-2 rounded">
                    {detailDialog.request.timeLogId}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">Submitted</div>
                  <div className="text-sm font-medium">
                    {new Date(detailDialog.request.createdAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(detailDialog.request.createdAt).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">Last Updated</div>
                  <div className="text-sm font-medium">
                    {new Date(detailDialog.request.updatedAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(detailDialog.request.updatedAt).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">Approver</div>
                  <div className="space-y-0.5">
                    {detailDialog.request.approver?.profile ? (
                      <>
                        <div className="text-sm font-medium break-words">
                          {detailDialog.request.approver.profile.firstName} {detailDialog.request.approver.profile.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground break-all">
                          {detailDialog.request.approver.email}
                        </div>
                      </>
                    ) : detailDialog.request.approver?.email ? (
                      <div className="text-sm font-medium break-all">
                        {detailDialog.request.approver.email}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">
                        Not assigned
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">Late Hours</div>
                  <div className="text-sm font-medium">
                    {detailDialog.request.lateHours ? Number(detailDialog.request.lateHours).toFixed(2) : "0.00"}h
                  </div>
                </div>
              </div>

              {/* Reason - Improved Layout */}
              {detailDialog.request.requesterReason && (
                <div className="space-y-2">
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-orange-500"></span>
                    Reason for Overtime
                  </div>
                  <div className="bg-muted/70 p-3 rounded-md text-xs sm:text-sm leading-relaxed border">
                    {detailDialog.request.requesterReason}
                  </div>
                </div>
              )}

              {/* Approver Comments - Improved Layout */}
              {detailDialog.request.approverComments && (
                <div className="space-y-2">
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-orange-500"></span>
                    {detailDialog.request.status === "approved" ? "Approval" : "Rejection"} Comments
                  </div>
                  <div className={`p-3 rounded-md text-xs sm:text-sm leading-relaxed border ${
                    detailDialog.request.status === "approved"
                      ? "bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100"
                      : "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100"
                  }`}>
                    {detailDialog.request.approverComments}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button 
              onClick={() => setDetailDialog({ open: false, request: null })}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}