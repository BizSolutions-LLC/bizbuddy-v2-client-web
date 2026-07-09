// Employee Leave Requests - Modern DataTable Version with Dashboard
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
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
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import socketService from "@/lib/socketService";
import DataTable from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DateTimePicker } from "@/components/DateTimePicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const toLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

const statusConfig = {
  pending: {
    label: "Pending Approval",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Clock,
  },
  pending_secondary: {
    label: "Pending Final Approval",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
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
  cancelled: {
    label: "Cancelled",
    color: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    icon: XCircle,
  },
};

// Leave type icons mapping
const leaveTypeIcons = {
  "Sick Leave": Heart,
  "Personal Leave": User,
  "Vacation Leave": Umbrella,
  "Maternity Leave": Baby,
  "Paternity Leave": Baby,
  "Emergency Leave": AlertCircle,
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

export default function EmployeeLeaveRequests() {
  const { token, user } = useAuthStore();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  
  // Dialog states
  const [detailDialog, setDetailDialog] = useState({ open: false, request: null });
  const [modalOpen, setModalOpen] = useState(false);
  
  // Form states
  const [policies, setPolicies] = useState([]);
  const [leaveType, setLeaveType] = useState("");
  const [approverId, setApproverId] = useState("");
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [balance, setBalance] = useState(null);
  const [shiftHours, setShiftHours] = useState(8);
  const [approvers, setApprovers] = useState([]);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Loading states for form data
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [loadingApprovers, setLoadingApprovers] = useState(false);

  // Calculate stats
  const stats = useMemo(() => {
    const total = leaves.length;
    const pending = leaves.filter(r => r.status === "pending").length;
    const pendingSecondary = leaves.filter(r => r.status === "pending_secondary").length;
    const approved = leaves.filter(r => r.status === "approved").length;
    const rejected = leaves.filter(r => r.status === "rejected").length;
    const totalDays = leaves
      .filter(r => r.status === "approved")
      .reduce((sum, r) => {
        if (r.startDate && r.endDate) {
          const start = new Date(r.startDate);
          const end = new Date(r.endDate);
          const diffTime = Math.abs(end - start);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          return sum + diffDays;
        }
        return sum;
      }, 0);

    return { total, pending, pendingSecondary, approved, rejected, totalDays };
  }, [leaves]);

  // Status tabs for the table
  const statusTabs = useMemo(() => [
    { label: "All", value: "all", count: stats.total },
    { label: "Pending", value: "pending", count: stats.pending },
    { label: "Pending Final", value: "pending_secondary", count: stats.pendingSecondary },
    { label: "Approved", value: "approved", count: stats.approved },
    { label: "Rejected", value: "rejected", count: stats.rejected },
  ], [leaves, stats]);

  // Table columns
  const columns = [
    {
      key: "leaveType",
      label: "Leave Type",
      render: (type) => {
        const Icon = leaveTypeIcons[type] || Calendar;
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <Icon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="font-medium">{type}</span>
          </div>
        );
      },
    },
    {
      key: "dateRange",
      label: "Date Range",
      render: (_, row) => (
        <div className="text-sm">
          <div className="font-medium">{toLocalDate(row.startDate).toLocaleDateString()}</div>
          <div className="text-xs text-muted-foreground">
            to {toLocalDate(row.endDate).toLocaleDateString()}
          </div>
          <div className="text-xs text-orange-600 font-medium">
            {(() => {
              const start = toLocalDate(row.startDate);
              const end = toLocalDate(row.endDate);
              const diffTime = end - start;
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
              return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
            })()}
          </div>
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
      key: "isPaid",
      label: "Pay Type",
      render: (isPaid) => isPaid === undefined ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : (
        <Badge variant="secondary" className={isPaid
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"
        }>
          <DollarSign className="h-3 w-3 mr-1" />
          {isPaid ? "Paid" : "Unpaid"}
        </Badge>
      ),
    },
    {
      key: "approver",
      label: "Approver",
      render: (_, row) => (
        <div className="text-sm">
          {row.approver?.name || row.approver?.email || "Not assigned"}
        </div>
      ),
    },
    {
      key: "leaveReason",
      label: "Reason",
      render: (reason) => (
        <div className="max-w-32 truncate text-sm text-muted-foreground">
          {reason || "No reason provided"}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Submitted",
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

  const fetchLeaves = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/leaves/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message || "Failed to fetch leave requests");
      
      setLeaves(data.data || []);
    } catch (error) {
      toast.error(error.message || "Failed to fetch leave requests");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchBalances = useCallback(async () => {
    if (!token) return;
    setLoadingBalances(true);
    try {
      // Fetch both balances and policies
      const [balancesRes, policiesRes] = await Promise.all([
        fetch(`${API_URL}/api/leaves/balances`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/leaves/policies`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);

      const balancesData = await balancesRes.json();
      const policiesData = await policiesRes.json();
      
      if (!balancesRes.ok) throw new Error(balancesData.message || "Failed to fetch leave balances");
      
      // Parse the data
      const balancesList = Array.isArray(balancesData.data) ? balancesData.data : [];
      const policiesList = Array.isArray(policiesData.data) ? policiesData.data : [];
      
      // Create a map of policies by leave type for quick lookup
      const policiesMap = {};
      policiesList.forEach(policy => {
        // Try different possible field names for credits
        const credits = Number(policy.credits) || 
                       Number(policy.totalCredits) || 
                       Number(policy.creditHours) || 
                       Number(policy.annualCredits) ||
                       Number(policy.maxCredits) ||
                       Number(policy.allowedCredits) ||
                       Number(policy.defaultCredits) ||
                       0;
        policiesMap[policy.leaveType] = credits;
      });
      
      // Merge balances with policy credits
      const parsedBalances = balancesList.map(bal => {
        const currentBalance = Number(bal.balanceHours) || 0;
        let totalCredits = policiesMap[bal.leaveType] || 0;
        
        // If totalCredits is 0 but currentBalance exists, use currentBalance as totalCredits
        // This handles the case where balance hours represent the full allocation
        if (totalCredits === 0 && currentBalance > 0) {
          totalCredits = currentBalance;
        }
        
        return {
          leaveType: bal.leaveType || '',
          currentBalance: currentBalance,
          totalCredits: totalCredits,
          shiftHours: Number(bal.shiftHours) || 8,
        };
      });
      
      setBalances(parsedBalances);
    } catch (error) {
      console.error("Failed to fetch leave balances:", error);
      toast.error("Failed to load leave balances");
    } finally {
      setLoadingBalances(false);
    }
  }, [token]);

  // Fetch policies, and approvers when modal opens
  useEffect(() => {
    if (!token || !modalOpen) return;
    
    const fetchModalData = async () => {
      try {
        // Set loading states
        setLoadingPolicies(true);
        setLoadingApprovers(true);

        const [policiesRes, approversRes] = await Promise.all([
          fetch(`${API_URL}/api/leaves/policies`, { 
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store"
          }),
          fetch(`${API_URL}/api/leaves/approvers`, { 
            headers: { Authorization: `Bearer ${token}` } 
          }),
        ]);

        // Handle policies
        setLoadingPolicies(false);
        if (policiesRes.ok) {
          const policiesData = await policiesRes.json();
          const policiesList = Array.isArray(policiesData.data) ? policiesData.data : [];
          setPolicies(policiesList);
          const companyShift = policiesList[0]?.defaultShiftHours != null 
            ? policiesList[0].defaultShiftHours 
            : 8;
          setShiftHours(companyShift);
        } else {
          toast.error("Failed to load leave policies");
        }

        // Handle approvers
        setLoadingApprovers(false);
        if (approversRes.ok) {
          const approversData = await approversRes.json();
          const approversList = Array.isArray(approversData.data) ? approversData.data : [];
          setApprovers(approversList.map(a => ({
            ...a,
            label: a.email || a.username || `User ${a.id}`,
          })));
        } else {
          toast.error("Failed to load approvers");
        }
      } catch (error) {
        setLoadingPolicies(false);
        setLoadingApprovers(false);
        toast.error("Failed to load form data");
      }
    };

    fetchModalData();
  }, [token, modalOpen]);

  // Calculate form progress and validation
  useEffect(() => {
    const fields = [leaveType, approverId, start, end];
    const completedFields = fields.filter(Boolean).length;
    const progressValue = Math.round((completedFields / fields.length) * 100);
    setProgress(progressValue);

    // Find balance for selected leave type
    if (leaveType && balances.length > 0) {
      const bal = balances.find(b => b.leaveType === leaveType);
      setBalance(bal?.currentBalance || 0);
    }
  }, [leaveType, approverId, start, end, balances]);

  const resetForm = () => {
    setLeaveType("");
    setApproverId("");
    setReason("");
    setStart("");
    setEnd("");
    setIsPaid(true);
    setBalance(null);
    setProgress(0);
    setErrors({});
  };

  const handleSubmit = async () => {
    setErrors({});
    const newErrors = {};

    if (!leaveType) newErrors.leaveType = "Leave type is required";
    if (!approverId) newErrors.approverId = "Approver is required";
    if (!start) newErrors.start = "Start date is required";
    if (!end) newErrors.end = "End date is required";

    if (start && end && new Date(start) > new Date(end)) {
      newErrors.end = "End date must be after start date";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/leaves/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: leaveType,
          approverId,
          leaveReason: reason,
          fromDate: start,
          toDate: end,
          isPaid,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Failed to submit leave request");

      toast.success("Leave request submitted successfully!");
      setModalOpen(false);
      resetForm();
      fetchLeaves();
      fetchBalances(); // Refresh balances after submitting
    } catch (error) {
      toast.error(error.message || "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchBalances();
  }, [fetchLeaves, fetchBalances]);

  // ── Socket: re-fetch balances when leave is fully approved ───────────────
  useEffect(() => {
    const handler = () => fetchBalances();
    socketService.on("leaveBalanceUpdated", handler);
    return () => socketService.off("leaveBalanceUpdated", handler);
  }, [fetchBalances]);

  // Calculate balance info for selected leave type
  const creditsForType = useMemo(() => {
    if (!leaveType || !policies.length) return null;
    const policy = policies.find(p => p.leaveType === leaveType);
    return policy?.credits || null;
  }, [leaveType, policies]);

  const requested = useMemo(() => {
    if (!start || !end) return 0;
    const diffTime = Math.abs(new Date(end) - new Date(start));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays * shiftHours;
  }, [start, end, shiftHours]);

  const exceeds = balance != null && creditsForType != null && requested > balance;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-muted-foreground">Submit and track your leave requests</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Days Taken</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.totalDays}</div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Balances Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-orange-600" />
              <CardTitle>Leave Balances</CardTitle>
            </div>
            {loadingBalances && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
          </div>
        </CardHeader>
        <CardContent>
          {loadingBalances ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : balances.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-4">
                <Briefcase className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Leave Balances Available</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Your leave balances have not been configured yet. Please contact your supervisor or HR department to set up your leave entitlements.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Need help? Reach out to your supervisor</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {balances.map((bal, index) => {
                const Icon = leaveTypeIcons[bal.leaveType] || Calendar;
                
                // Safely parse numeric values
                const totalCredits = Number(bal.totalCredits) || 0;
                const currentBalance = Number(bal.currentBalance) || 0;
                const hasNoCredits = totalCredits === 0;
                
                // Calculate usage safely
                const usedHours = hasNoCredits ? 0 : totalCredits - currentBalance;
                const usedPercentage = hasNoCredits ? 0 : (usedHours / totalCredits) * 100;
                const isLow = usedPercentage > 75;
                
                return (
                  <Card key={bal.leaveType || index} className="border-2 hover:border-orange-200 dark:hover:border-orange-800 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          hasNoCredits
                            ? 'bg-gray-100 dark:bg-gray-900/30'
                            : isLow 
                              ? 'bg-red-100 dark:bg-red-900/30' 
                              : 'bg-orange-100 dark:bg-orange-900/30'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            hasNoCredits
                              ? 'text-gray-600 dark:text-gray-400'
                              : isLow 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-orange-600 dark:text-orange-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-sm font-medium line-clamp-1">
                            {bal.leaveType || 'Unknown Leave Type'}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {currentBalance === 0 && totalCredits === 0 ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-muted-foreground mb-3">
                            No credits allocated
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                            <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <p className="text-left">
                                This leave type has not been configured for your account. Please contact your supervisor or HR to set up your entitlement.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : totalCredits === 0 || totalCredits === currentBalance ? (
                        // Show available balance only when we don't have total credits info
                        <>
                          <div className="text-center py-2">
                            <div className="text-4xl font-bold text-orange-600">
                              {currentBalance.toFixed(0)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">hours available</div>
                          </div>
                          
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mt-3">
                            <div className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <p className="text-left">
                                You have {currentBalance.toFixed(0)} hours available for this leave type.
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        // Show full breakdown when we have both values
                        <>
                          <div className="flex items-baseline justify-between">
                            <div>
                              <div className={`text-3xl font-bold ${
                                isLow ? 'text-red-600' : 'text-orange-600'
                              }`}>
                                {currentBalance.toFixed(0)}
                              </div>
                              <div className="text-xs text-muted-foreground">hours available</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-muted-foreground">
                                of {totalCredits.toFixed(0)}h
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Used</span>
                              <span className="font-medium">{usedPercentage.toFixed(0)}%</span>
                            </div>
                            <Progress 
                              value={usedPercentage} 
                              className={`h-2 ${
                                isLow 
                                  ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-900/30' 
                                  : '[&>div]:bg-orange-500 bg-orange-100 dark:bg-orange-900/30'
                              }`} 
                            />
                          </div>

                          <div className="pt-2 border-t text-xs text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Used:</span>
                              <span className="font-medium">{usedHours.toFixed(0)}h</span>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-600" />
            <CardTitle>Leave Requests History</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            data={leaves}
            columns={columns}
            loading={loading}
            onRefresh={fetchLeaves}
            actions={actions}
            searchPlaceholder="Search by leave type, reason, or status..."
            statusTabs={statusTabs}
            onRowClick={(request) => setDetailDialog({ open: true, request })}
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, request: null })}>
        <DialogContent className="sm:max-w-lg">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              Leave Request Details
            </DialogTitle>
          </DialogHeader>

          {detailDialog.request && (
            <div className="space-y-6">
              {/* Status and Leave Type */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge status={detailDialog.request.status} />
                  {detailDialog.request.isPaid !== undefined && (
                    <Badge variant="secondary" className={
                      detailDialog.request.isPaid
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"
                    }>
                      <DollarSign className="h-3 w-3 mr-1" />
                      {detailDialog.request.isPaid ? "Paid" : "Unpaid"}
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{detailDialog.request.leaveType}</div>
                  <div className="text-sm text-muted-foreground">Leave Type</div>
                </div>
              </div>

              {/* Date Range */}
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  <div className="font-medium text-orange-700 dark:text-orange-300">Leave Period</div>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date:</span>
                    <span className="font-medium">{toLocalDate(detailDialog.request.startDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End Date:</span>
                    <span className="font-medium">{toLocalDate(detailDialog.request.endDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium text-orange-600">
                      {(() => {
                        const start = new Date(detailDialog.request.startDate);
                        const end = new Date(detailDialog.request.endDate);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(0, 0, 0, 0);
                        const diffTime = end - start;
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Request ID</div>
                  <div className="font-mono text-xs">{detailDialog.request.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Approver</div>
                  <div className="font-medium">{detailDialog.request.approver?.name || detailDialog.request.approver?.email || "Not assigned"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Submitted</div>
                  <div className="font-medium">{new Date(detailDialog.request.createdAt).toLocaleDateString()} {new Date(detailDialog.request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Last Updated</div>
                  <div className="font-medium">{new Date(detailDialog.request.updatedAt).toLocaleDateString()} {new Date(detailDialog.request.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>

              {/* Reason */}
              {detailDialog.request.leaveReason && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Reason for Leave</div>
                  <div className="bg-muted p-3 rounded-md text-sm">
                    {detailDialog.request.leaveReason}
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

      {/* New Request Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Send className="h-5 w-5 text-orange-500" />
              New Leave Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Form completion</span>
                <span className="font-medium text-orange-500">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 [&>div]:bg-orange-500 bg-black/10 dark:bg-white/10" />
            </div>

            {/* Form Fields */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  Leave type <span className="text-orange-500">*</span>
                </label>
                <Select value={leaveType} onValueChange={(v) => { setLeaveType(v); setErrors((e) => ({ ...e, leaveType: undefined })); }} disabled={loadingPolicies}>
                  <SelectTrigger className={errors.leaveType ? "border-red-500" : ""}>
                    <SelectValue placeholder={loadingPolicies ? "Loading leave types..." : "Select leave type"} />
                    {loadingPolicies && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
                  </SelectTrigger>
                  <SelectContent>
                    {loadingPolicies ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-500 mr-2" />
                        <span className="text-sm text-muted-foreground">Loading leave types...</span>
                      </div>
                    ) : policies.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">No leave types available</div>
                    ) : (
                      policies.map((p) => (
                        <SelectItem key={p.leaveType} value={p.leaveType}>{p.leaveType}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {creditsForType != null && balance != null && (
                  <div className={`text-xs p-2 rounded-md ${exceeds ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"}`}>
                    <p className="font-medium">Balance: {balance}h of {creditsForType}h</p>
                    {requested > 0 && <p className="mt-1">Requesting: {requested}h {exceeds && "⚠️ Exceeds balance"}</p>}
                  </div>
                )}
                {errors.leaveType && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.leaveType}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-orange-500" />
                  Approver <span className="text-orange-500">*</span>
                </label>
                <Select value={approverId} onValueChange={(v) => { setApproverId(v); setErrors((e) => ({ ...e, approverId: undefined })); }} disabled={loadingApprovers}>
                  <SelectTrigger className={errors.approverId ? "border-red-500" : ""}>
                    <SelectValue placeholder={loadingApprovers ? "Loading approvers..." : "Select approver"} />
                    {loadingApprovers && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {loadingApprovers ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-500 mr-2" />
                        <span className="text-sm text-muted-foreground">Loading approvers...</span>
                      </div>
                    ) : approvers.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">No approvers available</div>
                    ) : (
                      approvers.map((a) => {
                        // Show role badge for clarity
                        const roleLabel = a.role === 'superadmin' ? 'Super Admin' : 
                                        a.role === 'admin' ? 'Admin' : 
                                        a.role === 'supervisor' ? 'Supervisor' : a.role;
                        return (
                          <SelectItem key={a.id} value={String(a.id)}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{a.label}</span>
                              <span className="text-xs text-muted-foreground">({roleLabel})</span>
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                {errors.approverId && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.approverId}</p>}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  Start date <span className="text-orange-500">*</span>
                </label>
                <DateTimePicker value={start} onChange={(v) => { setStart(v); setErrors((e) => ({ ...e, start: undefined })); }} placeholder="Select start" />
                {errors.start && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.start}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  End date <span className="text-orange-500">*</span>
                </label>
                <DateTimePicker value={end} onChange={(v) => { setEnd(v); setErrors((e) => ({ ...e, end: undefined })); }} placeholder="Select end" />
                {errors.end && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.end}</p>}
              </div>
            </div>

            {/* Paid / Unpaid toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-500" />
                Leave Pay Type
              </label>
              <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setIsPaid(true)}
                  className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isPaid
                      ? "bg-green-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaid(false)}
                  className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    !isPaid
                      ? "bg-red-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Unpaid
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isPaid ? "This leave will be compensated." : "This leave will not be compensated."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-500" />
                Reason <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <Textarea placeholder="Provide a reason for your leave request..." value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[100px] resize-none" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }} disabled={submitting}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={handleSubmit} disabled={submitting || progress < 100}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</> : <><Send className="h-4 w-4" />Submit Request</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}