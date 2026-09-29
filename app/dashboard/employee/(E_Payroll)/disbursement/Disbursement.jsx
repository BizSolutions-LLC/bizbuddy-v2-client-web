"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileImage,
  Loader2,
  Search,
  Upload,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  approveDisbursementBatch,
  canApproveDisbursement,
  canCreateDisbursement,
  canMarkPaymentSent,
  canViewDisbursement,
  cancelDisbursementBatch,
  createDisbursementFromPayrollRun,
  DISBURSEMENT_STATUS_LABELS,
  disbursementStatusClass,
  fetchDisbursementBatch,
  fetchDisbursementBatches,
  fetchDisbursementPaymentProof,
  fetchDisbursementSummary,
  fetchRecipientPaymentProof,
  formatDisbursementCurrency,
  formatDisbursementDate,
  formatDisbursementDay,
  markDisbursementPaid,
  markRecipientPaymentSent,
  PAYMENT_METHOD_LABELS,
  RECIPIENT_STATUS_LABELS,
} from "@/lib/disbursementApi";

function StatusBadge({ status, labels = DISBURSEMENT_STATUS_LABELS }) {
  return (
    <Badge variant="outline" className={disbursementStatusClass(status)}>
      {labels[status] || status || "—"}
    </Badge>
  );
}

function formatPeriod(run) {
  if (!run?.periodStart && !run?.periodEnd) return "—";
  return `${formatDisbursementDay(run.periodStart)} – ${formatDisbursementDay(run.periodEnd)}`;
}

const PROOF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf";
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

function isAllowedProofFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  if (["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"].includes(type)) {
    return true;
  }
  return [".png", ".jpg", ".jpeg", ".webp", ".pdf"].some((ext) => name.endsWith(ext));
}

export default function Disbursement() {
  const { token } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [role, setRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState(searchParams.get("batchId"));
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("CHECK");
  const [proofFile, setProofFile] = useState(null);
  const [proofDragActive, setProofDragActive] = useState(false);
  const proofInputRef = useRef(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [eligibleRuns, setEligibleRuns] = useState([]);
  const [createRunId, setCreateRunId] = useState("");

  const canView = canViewDisbursement(role);
  const canCreate = canCreateDisbursement(role);
  const canApprove = canApproveDisbursement(role);
  const canMarkPaid = canMarkPaymentSent(role);
  const isCreator = Boolean(detail?.createdById && currentUserId && detail.createdById === currentUserId);
  const isApprover = Boolean(detail?.approvedById && currentUserId && detail.approvedById === currentUserId);

  const loadProfile = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`${API_URL}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    const nextRole = payload?.data?.user?.role?.toLowerCase() || null;
    setRole(nextRole);
    setCurrentUserId(payload?.data?.user?.id || null);
    if (!canViewDisbursement(nextRole)) {
      toast.error("Access denied. Disbursement is limited to payroll administrators.");
      router.push("/dashboard/employee/payroll");
    }
  }, [API_URL, token, router]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [summaryData, listData] = await Promise.all([
        fetchDisbursementSummary(API_URL, token),
        fetchDisbursementBatches(API_URL, token, { limit: 100 }),
      ]);
      setSummary(summaryData);
      setBatches(listData?.batches || []);
    } catch (error) {
      toast.error(error.message || "Failed to load disbursements");
      setSummary(null);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, token]);

  const loadEligibleRuns = useCallback(async () => {
    if (!token || !canCreate) return;
    try {
      const [runsRes, listData] = await Promise.all([
        fetch(`${API_URL}/api/payroll-system/payroll-runs?status=finalized&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchDisbursementBatches(API_URL, token, { limit: 200 }),
      ]);
      const runsPayload = await runsRes.json();
      const runs = runsPayload?.data?.payrollRuns || [];
      const activeRunIds = new Set(
        (listData?.batches || [])
          .filter((batch) => batch.status !== "CANCELLED")
          .map((batch) => batch.payrollRunId)
      );
      setEligibleRuns(runs.filter((run) => run.locked && !activeRunIds.has(run.id)));
    } catch {
      setEligibleRuns([]);
    }
  }, [API_URL, token, canCreate]);

  const loadDetail = useCallback(async (batchId) => {
    if (!token || !batchId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const data = await fetchDisbursementBatch(API_URL, token, batchId);
      setDetail(data);
    } catch (error) {
      toast.error(error.message || "Failed to load disbursement batch");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [API_URL, token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (canView) {
      loadDashboard();
      loadEligibleRuns();
    }
  }, [canView, loadDashboard, loadEligibleRuns]);

  useEffect(() => {
    const fromQuery = searchParams.get("batchId");
    if (fromQuery && fromQuery !== selectedBatchId) {
      setSelectedBatchId(fromQuery);
    }
  }, [searchParams, selectedBatchId]);

  useEffect(() => {
    loadDetail(selectedBatchId);
  }, [selectedBatchId, loadDetail]);

  const filteredBatches = useMemo(() => {
    if (!batchSearch.trim()) return batches;
    const q = batchSearch.trim().toLowerCase();
    return batches.filter((batch) => {
      const period = formatPeriod(batch.payrollRun).toLowerCase();
      return (
        batch.id.toLowerCase().includes(q) ||
        period.includes(q) ||
        (DISBURSEMENT_STATUS_LABELS[batch.status] || batch.status || "").toLowerCase().includes(q) ||
        (batch.createdBy?.name || "").toLowerCase().includes(q)
      );
    });
  }, [batches, batchSearch]);

  const filteredRecipients = useMemo(() => {
    const recipients = detail?.recipients || [];
    if (!recipientSearch.trim()) return recipients;
    const q = recipientSearch.trim().toLowerCase();
    return recipients.filter((recipient) =>
      [recipient.employeeName, recipient.email, recipient.employeeNumber, recipient.payoutProviderAccountId, recipient.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [detail, recipientSearch]);

  const unpaidPayableRecipients = useMemo(
    () =>
      (detail?.recipients || []).filter(
        (recipient) => recipient.status !== "PAID" && recipient.status !== "BLOCKED"
      ),
    [detail]
  );
  const paidRecipientCount = (detail?.recipients || []).filter((recipient) => recipient.status === "PAID").length;
  const canRecordPayment = Boolean(
    canMarkPaid && detail?.status === "READY_FOR_DISBURSEMENT" && !isApprover
  );
  const markPaidRecipient = markPaidTarget?.type === "recipient" ? markPaidTarget.recipient : null;

  const stats = [
    {
      label: "Payroll ready for disbursement",
      value: formatDisbursementCurrency(summary?.totalPayrollReadyForDisbursement, summary?.currency),
      hint: "Finalized payroll without an active batch",
      icon: Wallet,
      color: "text-orange-600",
    },
    {
      label: "Payroll batches",
      value: summary?.payrollBatchCount ?? "—",
      hint: "Finalized payroll runs",
      icon: Banknote,
      color: "text-blue-600",
    },
    {
      label: "Employees awaiting payout setup",
      value: summary?.employeesAwaitingPayoutSetup ?? "—",
      hint: "No provider account on file",
      icon: Users,
      color: "text-amber-600",
    },
    {
      label: "Awaiting approval",
      value: summary?.batchesAwaitingApproval ?? "—",
      hint: "Ready for review",
      icon: Clock,
      color: "text-orange-600",
    },
    {
      label: "Ready for submission",
      value: summary?.batchesReadyForSubmission ?? "—",
      hint: "Approved, provider not connected",
      icon: CheckCircle2,
      color: "text-green-600",
    },
    {
      label: "Completed batches",
      value: summary?.completedBatches ?? "—",
      hint: "Provider confirmed payout",
      icon: CheckCircle2,
      color: "text-green-600",
    },
    {
      label: "Failed / exception batches",
      value: summary?.failedOrExceptionBatches ?? "—",
      hint: "Failed or needs review",
      icon: XCircle,
      color: "text-red-600",
    },
  ];

  const handleCreate = async (payrollRunId) => {
    if (!payrollRunId) return;
    setActionLoading(true);
    try {
      const created = await createDisbursementFromPayrollRun(API_URL, token, payrollRunId);
      toast.success("Disbursement batch created from finalized payroll.");
      setCreateRunId("");
      await loadDashboard();
      await loadEligibleRuns();
      setSelectedBatchId(created.id);
      router.replace(`/dashboard/employee/disbursement?batchId=${created.id}`);
    } catch (error) {
      toast.error(error.message || "Failed to create disbursement batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!detail?.id) return;
    setActionLoading(true);
    try {
      await approveDisbursementBatch(API_URL, token, detail.id);
      toast.success("Disbursement batch approved.");
      setApproveOpen(false);
      await loadDashboard();
      await loadDetail(detail.id);
    } catch (error) {
      toast.error(error.message || "Failed to approve disbursement batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!detail?.id) return;
    setActionLoading(true);
    try {
      await cancelDisbursementBatch(API_URL, token, detail.id);
      toast.success("Disbursement batch cancelled.");
      setCancelOpen(false);
      await loadDashboard();
      await loadEligibleRuns();
      await loadDetail(detail.id);
    } catch (error) {
      toast.error(error.message || "Failed to cancel disbursement batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!detail?.id) return;
    if (!proofFile) {
      toast.error("Attach a screenshot as proof of payment.");
      return;
    }
    setActionLoading(true);
    try {
      if (markPaidRecipient) {
        await markRecipientPaymentSent(API_URL, token, detail.id, markPaidRecipient.id, {
          paymentMethod,
          file: proofFile,
        });
        toast.success(`Payment marked as sent for ${markPaidRecipient.employeeName}. No bank transfer was made from this app.`);
      } else {
        await markDisbursementPaid(API_URL, token, detail.id, {
          paymentMethod,
          file: proofFile,
        });
        toast.success("Payment marked as sent. No bank transfer was made from this app.");
      }
      setMarkPaidOpen(false);
      setMarkPaidTarget(null);
      clearProofFile();
      await loadDashboard();
      await loadDetail(detail.id);
    } catch (error) {
      toast.error(error.message || "Failed to mark payment sent");
    } finally {
      setActionLoading(false);
    }
  };

  const clearProofFile = () => {
    setProofFile(null);
    setProofDragActive(false);
    if (proofInputRef.current) proofInputRef.current.value = "";
  };

  const applyProofFile = (file) => {
    if (!file) {
      clearProofFile();
      return;
    }
    if (file.size > PROOF_MAX_BYTES) {
      toast.error("Payment proof must be 5MB or smaller.");
      return;
    }
    if (!isAllowedProofFile(file)) {
      toast.error("Payment proof must be a PNG, JPEG, WebP, or PDF.");
      return;
    }
    setProofFile(file);
  };

  const openMarkPaidDialog = (target) => {
    setMarkPaidTarget(target);
    setPaymentMethod("CHECK");
    clearProofFile();
    setMarkPaidOpen(true);
  };

  const showProofBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    setProofPreviewUrl(url);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openProof = async () => {
    if (!detail?.id) return;
    try {
      showProofBlob(await fetchDisbursementPaymentProof(API_URL, token, detail.id));
    } catch (error) {
      toast.error(error.message || "Failed to open payment proof");
    }
  };

  const openRecipientProof = async (recipientId) => {
    if (!detail?.id) return;
    try {
      showProofBlob(await fetchRecipientPaymentProof(API_URL, token, detail.id, recipientId));
    } catch (error) {
      toast.error(error.message || "Failed to open employee payment proof");
    }
  };

  if (!canView && role) {
    return null;
  }

  return (
    <div className="p-0 sm:p-4 lg:p-6 min-w-0">
      <Toaster />
      <div className="bg-white rounded-lg shadow-md min-w-0 p-3 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Disbursement</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Snapshot finalized payroll for review and approval. Money movement is not enabled yet.
            </p>
          </div>
          {canCreate && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={createRunId}
                onChange={(event) => setCreateRunId(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select finalized payroll…</option>
                {eligibleRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {formatDisbursementDay(run.periodStart)} – {formatDisbursementDay(run.periodEnd)} ·{" "}
                    {formatDisbursementCurrency(run.totalNet)}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => handleCreate(createRunId)}
                disabled={!createRunId || actionLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create Disbursement Batch
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {loading ? "—" : stat.value}
                </div>
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {detail ? (
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedBatchId(null);
                setDetail(null);
                router.replace("/dashboard/employee/disbursement");
              }}
              className="px-0 text-orange-700 hover:text-orange-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to batches
            </Button>

            {detailLoading ? (
              <div className="flex items-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading batch details…
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      Disbursement {detail.id.slice(-6).toUpperCase()}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Recipients: {detail.recipientCount} · Total:{" "}
                      {formatDisbursementCurrency(detail.totalAmount, detail.currency)} · Currency:{" "}
                      {detail.currency} · Period: {formatPeriod(detail.payrollRun)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={detail.status} />
                    {canApprove && detail.status === "READY_FOR_REVIEW" && !isCreator && (
                      <Button
                        onClick={() => setApproveOpen(true)}
                        disabled={detail.hasBlockingErrors || actionLoading}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        Approve Disbursement
                      </Button>
                    )}
                    {canApprove && detail.status === "READY_FOR_REVIEW" && isCreator && (
                      <span className="text-xs text-muted-foreground">Waiting for a second person to approve.</span>
                    )}
                    {canCreate && ["READY_FOR_REVIEW", "APPROVED", "READY_FOR_DISBURSEMENT"].includes(detail.status) && (
                      <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={actionLoading}>
                        Cancel
                      </Button>
                    )}
                    {canRecordPayment && unpaidPayableRecipients.length > 0 && (
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => openMarkPaidDialog({ type: "batch" })}
                        disabled={actionLoading}
                      >
                        {paidRecipientCount > 0
                          ? `Mark remaining as sent (${unpaidPayableRecipients.length})`
                          : "Mark payment sent"}
                      </Button>
                    )}
                    {canMarkPaid && detail.status === "READY_FOR_DISBURSEMENT" && isApprover && (
                      <span className="text-xs text-muted-foreground">A different administrator must attach payment proof.</span>
                    )}
                  </div>
                </div>

                {detail.provider?.message && (
                  <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <AlertTitle>Provider information</AlertTitle>
                    <AlertDescription>{detail.provider.message}</AlertDescription>
                  </Alert>
                )}

                {detail.hasBlockingErrors && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Blocking errors</AlertTitle>
                    <AlertDescription>
                      {(detail.blockingIssues || []).map((issue) => issue.message).join(" ")} This batch cannot be approved until these are resolved.
                    </AlertDescription>
                  </Alert>
                )}

                {(detail.warningIssues || []).length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      {(detail.warningIssues || []).length} warning{(detail.warningIssues || []).length === 1 ? "" : "s"} found. Warnings do not block approval by themselves.
                    </AlertDescription>
                  </Alert>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recipients</CardTitle>
                    <Input
                      value={recipientSearch}
                      onChange={(event) => setRecipientSearch(event.target.value)}
                      placeholder="Search employees, accounts, or status…"
                      className="max-w-sm"
                    />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Payout Status</TableHead>
                          <TableHead>Provider Account</TableHead>
                          <TableHead>Recipient Status</TableHead>
                          <TableHead>Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecipients.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6}>No recipients match this search.</TableCell>
                          </TableRow>
                        ) : (
                          filteredRecipients.map((recipient) => {
                            const warnings = (recipient.issues || []).filter((issue) => issue.severity === "WARNING");
                            const blockers = (recipient.issues || []).filter((issue) => issue.severity === "BLOCKING");
                            return (
                              <TableRow key={recipient.id}>
                                <TableCell className="text-left">
                                  <div className="font-medium">{recipient.employeeName}</div>
                                  <div className="text-xs text-muted-foreground">{recipient.email || recipient.employeeNumber || recipient.employeeId}</div>
                                </TableCell>
                                <TableCell>{formatDisbursementCurrency(recipient.amount, recipient.currency)}</TableCell>
                                <TableCell>
                                  {recipient.payoutProviderAccountId ? "Configured" : "Missing payout setup"}
                                </TableCell>
                                <TableCell>{recipient.payoutProviderAccountId || "—"}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col items-center gap-1">
                                    <StatusBadge status={recipient.status} labels={RECIPIENT_STATUS_LABELS} />
                                    {blockers.map((issue) => (
                                      <span key={`${recipient.id}-${issue.code}`} className="text-[11px] text-red-700">
                                        {issue.message}
                                      </span>
                                    ))}
                                    {warnings.map((issue) => (
                                      <span key={`${recipient.id}-${issue.code}`} className="text-[11px] text-amber-700">
                                        {issue.message}
                                      </span>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col items-start gap-1">
                                    {recipient.status === "PAID" ? (
                                      <>
                                        <span className="text-xs text-muted-foreground">
                                          {PAYMENT_METHOD_LABELS[recipient.paymentMethod] || recipient.paymentMethod || "Sent"}
                                          {recipient.paymentMarkedBy?.name ? ` · ${recipient.paymentMarkedBy.name}` : ""}
                                        </span>
                                        {recipient.paymentProof?.hasProof && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openRecipientProof(recipient.id)}
                                          >
                                            View proof
                                          </Button>
                                        )}
                                      </>
                                    ) : canRecordPayment && recipient.status !== "BLOCKED" ? (
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => openMarkPaidDialog({ type: "recipient", recipient })}
                                        disabled={actionLoading}
                                      >
                                        Mark sent
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Approval history</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>Created by {detail.createdBy?.name || "—"} on {formatDisbursementDate(detail.createdAt)}</p>
                      <p>Approved by {detail.approvedBy?.name || "—"} {detail.approvedAt ? `on ${formatDisbursementDate(detail.approvedAt)}` : ""}</p>
                      <p>
                        Payment sent {detail.paymentMarkedAt
                          ? formatDisbursementDate(detail.paymentMarkedAt)
                          : paidRecipientCount > 0
                            ? "per employee"
                            : "—"}
                        {detail.paymentMethod ? ` via ${PAYMENT_METHOD_LABELS[detail.paymentMethod] || detail.paymentMethod}` : ""}
                      </p>
                      <p>Recorded by {detail.paymentMarkedBy?.name || "—"}</p>
                      {detail.paymentProof?.hasProof && (
                        <Button variant="outline" size="sm" onClick={openProof}>
                          View payment proof
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Audit history</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-72 overflow-auto">
                      {(detail.auditEvents || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No audit events yet.</p>
                      ) : (
                        (detail.auditEvents || []).map((event) => (
                          <div key={event.id} className="border-b pb-2 last:border-0">
                            <p className="text-sm font-medium">{event.action.replaceAll("_", " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.actorName || "System"} · {formatDisbursementDate(event.createdAt)}
                              {event.previousState ? ` · ${event.previousState} → ${event.newState}` : event.newState ? ` · ${event.newState}` : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        ) : (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Recent batches</CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={batchSearch}
                  onChange={(event) => setBatchSearch(event.target.value)}
                  placeholder="Search batches…"
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading batches…
                </div>
              ) : filteredBatches.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No disbursement batches yet. Create one from a finalized payroll run.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ID</TableHead>
                      <TableHead>Payroll period</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created by</TableHead>
                      <TableHead>Created date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono text-xs">{batch.id.slice(-8)}</TableCell>
                        <TableCell>{formatPeriod(batch.payrollRun)}</TableCell>
                        <TableCell>{batch.recipientCount}</TableCell>
                        <TableCell>{formatDisbursementCurrency(batch.totalAmount, batch.currency)}</TableCell>
                        <TableCell>{batch.currency}</TableCell>
                        <TableCell><StatusBadge status={batch.status} /></TableCell>
                        <TableCell>{batch.createdBy?.name || "—"}</TableCell>
                        <TableCell>{formatDisbursementDay(batch.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedBatchId(batch.id);
                              router.replace(`/dashboard/employee/disbursement?batchId=${batch.id}`);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Disbursement</AlertDialogTitle>
            <AlertDialogDescription>
              A different person from the creator must approve. Supervisors and admins can approve.
              Totals are taken from the server. Recipient amounts cannot be changed after approval.
              This does not send money.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 text-sm">
            <p>Recipients: {detail?.recipientCount ?? 0}</p>
            <p>Total: {formatDisbursementCurrency(detail?.totalAmount, detail?.currency)}</p>
            <p>Currency: {detail?.currency || "USD"}</p>
            <p>Payroll period: {formatPeriod(detail?.payrollRun)}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={actionLoading || detail?.hasBlockingErrors}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Approve Disbursement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel disbursement batch?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelling this batch will allow a new disbursement to be created from the same payroll run. This does not move money.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Keep batch</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={actionLoading} className="bg-destructive text-destructive-foreground">
              Cancel batch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={markPaidOpen}
        onOpenChange={(open) => {
          setMarkPaidOpen(open);
          if (!open) {
            setMarkPaidTarget(null);
            clearProofFile();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {markPaidRecipient
                ? `Mark payment sent for ${markPaidRecipient.employeeName}`
                : paidRecipientCount > 0
                  ? "Mark remaining payment sent"
                  : "Mark payment sent"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Record that this payroll was paid outside BizBuddy. This does not transfer money.
              A screenshot of the check, transfer, or receipt is required
              {markPaidRecipient ? " for this employee." : " for the remaining unpaid employees."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            {markPaidRecipient ? (
              <p>Amount: {formatDisbursementCurrency(markPaidRecipient.amount, markPaidRecipient.currency)}</p>
            ) : (
              <>
                <p>Remaining recipients: {unpaidPayableRecipients.length}</p>
                <p>
                  Remaining total:{" "}
                  {formatDisbursementCurrency(
                    unpaidPayableRecipients.reduce((sum, recipient) => sum + (recipient.amount || 0), 0),
                    detail?.currency
                  )}
                </p>
              </>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="payment-method">Payment sent via</label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="payment-proof">Screenshot / proof</label>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setProofDragActive(true);
                }}
                onDragLeave={() => setProofDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setProofDragActive(false);
                  applyProofFile(event.dataTransfer.files?.[0] || null);
                }}
                onClick={() => proofInputRef.current?.click()}
                className={`rounded-lg border-2 border-dashed p-5 text-center space-y-2 cursor-pointer transition-colors ${
                  proofDragActive
                    ? "border-orange-500 bg-orange-50"
                    : "border-muted-foreground/25 hover:border-orange-400"
                }`}
              >
                <input
                  ref={proofInputRef}
                  id="payment-proof"
                  type="file"
                  accept={PROOF_ACCEPT}
                  className="hidden"
                  onChange={(event) => applyProofFile(event.target.files?.[0] || null)}
                />
                {proofFile ? (
                  <div className="space-y-1">
                    <FileImage className="h-7 w-7 mx-auto text-green-600" />
                    <p className="text-sm font-medium">{proofFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(proofFile.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      type="button"
                      className="text-sm text-orange-600 hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        clearProofFile();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-7 w-7 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag a screenshot here, or click to browse
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        proofInputRef.current?.click();
                      }}
                    >
                      Browse files
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or PDF · up to 5MB</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkPaid}
              disabled={actionLoading || !proofFile}
              className="bg-green-600 hover:bg-green-700"
            >
              Mark payment sent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
