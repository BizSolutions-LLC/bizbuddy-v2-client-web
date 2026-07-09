// components/Dashboard/DepartmentHead/OvertimeRequests.jsx
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMMDDYYYY_hhmma } from "@/lib/dateTimeFormatter";

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

export default function OvertimeRequests() {
  const { token, user } = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState([]);
  
  // Dialog states
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, request: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, request: null });
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Calculate stats
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === "pending").length;
    const approved = requests.filter(r => r.status === "approved").length;
    const approvedHours = requests
      .filter(r => r.status === "approved")
      .reduce((sum, r) => sum + Number(r.requestedHours || 0), 0);

    return { total, pending, approved, approvedHours: approvedHours.toFixed(1) };
  }, [requests]);

  // Status tabs for the table
  const statusTabs = useMemo(() => [
    { label: "All", value: "all", count: stats.total },
    { label: "Pending", value: "pending", count: stats.pending },
    { label: "Approved", value: "approved", count: stats.approved },
    { label: "Rejected", value: "rejected", count: requests.filter(r => r.status === "rejected").length },
  ], [requests, stats]);

  // Table columns
  const columns = [
    {
      key: "requester",
      label: "Employee",
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="font-medium text-sm">
              {row.requester?.profile?.firstName} {row.requester?.profile?.lastName}
            </div>
            <div className="text-xs text-muted-foreground">{row.requester?.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "requestedHours",
      label: "OT Hours",
      render: (hours) => (
        <div className="font-mono text-sm">
          {Number(hours).toFixed(2)}h
        </div>
      ),
    },
    {
      key: "lateHours", 
      label: "Late Hours",
      render: (hours) => (
        <div className="font-mono text-sm text-muted-foreground">
          {hours ? Number(hours).toFixed(2) : "0.00"}h
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (status) => <StatusBadge status={status} />,
      sortable: true,
    },
    {
      key: "createdAt",
      label: "Submitted",
      render: (date) => (
        <div className="text-sm">
          <div>{new Date(date).toLocaleDateString()}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
      sortable: true,
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
  ];

  // Table actions
  const actions = [
    {
      label: "View Details",
      icon: Eye,
      onClick: (request) => setDetailDialog({ open: true, request }),
    },
    ...(user?.role && ["admin", "supervisor", "superadmin"].includes(user.role) ? [
      {
        label: "Approve",
        icon: CheckCircle2,
        onClick: (request) => {
          if (request.status === "pending") {
            setActionDialog({ open: true, type: "approve", request });
          }
        },
        className: "text-green-600",
      },
      {
        label: "Reject", 
        icon: XCircle,
        onClick: (request) => {
          if (request.status === "pending") {
            setActionDialog({ open: true, type: "reject", request });
          }
        },
        className: "text-red-600",
        separator: true,
      },
    ] : []),
  ];

  // Bulk actions
  const bulkActions = user?.role && ["admin", "supervisor", "superadmin"].includes(user.role) ? [
    {
      label: "Approve Selected",
      icon: CheckCircle2,
      variant: "default",
      onClick: (selectedIds) => {
        const pendingSelected = requests.filter(r => 
          selectedIds.includes(r.id) && r.status === "pending"
        );
        if (pendingSelected.length > 0) {
          // Handle bulk approve
        }
      },
    },
    {
      label: "Reject Selected",
      icon: XCircle,
      variant: "destructive", 
      onClick: (selectedIds) => {
        const pendingSelected = requests.filter(r => 
          selectedIds.includes(r.id) && r.status === "pending"
        );
        if (pendingSelected.length > 0) {
          // Handle bulk reject
        }
      },
    },
  ] : [];

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/overtime`, {
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

  const handleAction = async () => {
    if (!actionDialog.request || !actionDialog.type) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/overtime/${actionDialog.request.id}/${actionDialog.type}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approverComments: comment }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      toast.success(`Request ${actionDialog.type}d successfully`);
      setActionDialog({ open: false, type: null, request: null });
      setComment("");
      fetchRequests();
    } catch (error) {
      toast.error(error.message || `Failed to ${actionDialog.type} request`);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return (
    <div className="space-y-6">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Hours</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-orange-600">{stats.approvedHours}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <CardTitle>Employee Overtime Requests</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            data={requests}
            columns={columns}
            loading={loading}
            onRefresh={fetchRequests}
            actions={actions}
            bulkActions={bulkActions}
            searchPlaceholder="Search by employee, email, or reason..."
            statusTabs={statusTabs}
            selectable={bulkActions.length > 0}
            selectedRows={selectedRequests}
            onSelectionChange={setSelectedRequests}
            onRowClick={(request) => setDetailDialog({ open: true, request })}
          />
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, request: null })}>
        <DialogContent className="sm:max-w-md">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog.type === "approve" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {actionDialog.type === "approve" ? "Approve" : "Reject"} Overtime Request
            </DialogTitle>
          </DialogHeader>

          {actionDialog.request && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Employee:</span>
                  <span className="font-medium">{actionDialog.request.requester?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">OT Hours:</span>
                  <span className="font-medium">{Number(actionDialog.request.requestedHours).toFixed(2)}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Requested:</span>
                  <span className="font-medium">{new Date(actionDialog.request.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Comments {actionDialog.type === "reject" && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={`Add ${actionDialog.type === "approve" ? "approval" : "rejection"} comments...`}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, request: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading || (actionDialog.type === "reject" && !comment.trim())}
              className={
                actionDialog.type === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {actionLoading ? (
                actionDialog.type === "approve" ? "Approving..." : "Rejecting..."
              ) : (
                actionDialog.type === "approve" ? "Approve" : "Reject"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, request: null })}>
        <DialogContent className="sm:max-w-lg">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              Overtime Request Details
            </DialogTitle>
          </DialogHeader>

          {detailDialog.request && (
            <div className="space-y-6">
              {/* Status and Hours */}
              <div className="flex items-center justify-between">
                <StatusBadge status={detailDialog.request.status} />
                <div className="text-right">
                  <div className="text-lg sm:text-2xl font-bold">{Number(detailDialog.request.requestedHours).toFixed(2)}h</div>
                  <div className="text-sm text-muted-foreground">Overtime Hours</div>
                </div>
              </div>

              {/* Employee Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Employee</div>
                  <div className="font-medium">{detailDialog.request.requester?.email}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Late Hours</div>
                  <div className="font-medium">{detailDialog.request.lateHours ? Number(detailDialog.request.lateHours).toFixed(2) : "0.00"}h</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Submitted</div>
                  <div className="font-medium">{fmtMMDDYYYY_hhmma(detailDialog.request.createdAt)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">TimeLog ID</div>
                  <div className="font-mono text-xs">{detailDialog.request.timeLogId}</div>
                </div>
              </div>

              {/* Reason */}
              {detailDialog.request.requesterReason && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Reason for Overtime</div>
                  <div className="bg-muted p-3 rounded-md text-sm">
                    {detailDialog.request.requesterReason}
                  </div>
                </div>
              )}

              {/* Approver Comments */}
              {detailDialog.request.approverComments && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {detailDialog.request.status === "approved" ? "Approval" : "Rejection"} Comments
                  </div>
                  <div className={`p-3 rounded-md text-sm border ${
                    detailDialog.request.status === "approved"
                      ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                      : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  }`}>
                    {detailDialog.request.approverComments}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setDetailDialog({ open: false, request: null })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}