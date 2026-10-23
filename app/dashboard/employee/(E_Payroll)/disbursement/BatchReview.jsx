"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Ban, Banknote, Check, CircleAlert, FileImage, Landmark, Loader2, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  cancelDisbursementBatch,
  fetchDisbursementBatch,
  fetchPayoutProvider,
  formatDisbursementCurrency,
  formatDisbursementDate,
  formatDisbursementPeriod,
  isManualPaymentMethod,
  PAYMENT_METHOD_LABELS,
  RECIPIENT_STATUS_LABELS,
  updateEmployeePayoutDelivery,
} from "@/lib/disbursementApi";
import { AutomaticTransferNotice, DisbursementFrame, StatusBadge, useDisbursementSession } from "./disbursementUi";

function accountLabel(recipient) {
  if (recipient.payoutDelivery === "manual") return "Paid outside bank";
  if (recipient.payoutAccountLinked) return "Bank connected";
  return "Needs a bank account";
}

function paymentLabel(recipient) {
  if (recipient.status === "PAID") {
    return PAYMENT_METHOD_LABELS[recipient.paymentMethod] || recipient.paymentMethod || "Sent";
  }
  return recipient.payoutDelivery === "manual" ? "Manual payment" : "Automatic bank";
}

function recipientSortValue(recipient, key) {
  switch (key) {
    case "employee":
      return recipient.employeeName || "";
    case "amount":
      return Number(recipient.amount) || 0;
    case "account":
      return accountLabel(recipient);
    case "status":
      return RECIPIENT_STATUS_LABELS[recipient.status] || recipient.status || "";
    case "payment":
      return paymentLabel(recipient);
    default:
      return "";
  }
}

function compareRecipients(a, b, key) {
  const av = recipientSortValue(a, key);
  const bv = recipientSortValue(b, key);
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true });
}

function SortableHead({ label, column, sort, onSort, align = "left" }) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <TableHead
      className={align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex w-full items-center gap-1 font-medium text-muted-foreground hover:text-foreground ${justify}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-foreground" : "opacity-40"}`} />
      </button>
    </TableHead>
  );
}
import RecordOutsidePaymentDialog from "./RecordOutsidePaymentDialog";
import EmployeePayoutSetupDialog from "./EmployeePayoutSetupDialog";

export default function BatchReview({ batchId }) {
  const router = useRouter();
  const session = useDisbursementSession();
  const { token, apiUrl, userId, canView, canCreate, canApprove, canMarkPaid } = session;
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientSort, setRecipientSort] = useState({ key: null, direction: "asc" });
  const [approveOpen, setApproveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [automaticNoticeOpen, setAutomaticNoticeOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [provider, setProvider] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [payoutSetupId, setPayoutSetupId] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!token || !canView || !batchId) return;
    setDetailLoading(true);
    try {
      const [batch, providerData] = await Promise.all([
        fetchDisbursementBatch(apiUrl, token, batchId),
        fetchPayoutProvider(apiUrl, token).catch(() => ({ provider: null })),
      ]);
      setDetail(batch);
      setProvider(providerData?.provider || null);
    } catch (error) {
      toast.error(error.message || "Failed to load disbursement batch");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [apiUrl, token, canView, batchId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const isCreator = Boolean(detail?.createdById && userId && detail.createdById === userId);
  const isApprover = Boolean(detail?.approvedById && userId && detail.approvedById === userId);
  const recipients = detail?.recipients || [];
  const filteredRecipients = useMemo(() => {
    if (!recipientSearch.trim()) return recipients;
    const q = recipientSearch.trim().toLowerCase();
    return recipients.filter((recipient) =>
      [recipient.employeeName, recipient.email, recipient.employeeNumber, recipient.payoutProviderAccountId, recipient.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [recipients, recipientSearch]);
  const sortedRecipients = useMemo(() => {
    if (!recipientSort.key) return filteredRecipients;
    const direction = recipientSort.direction === "desc" ? -1 : 1;
    return [...filteredRecipients].sort((a, b) => {
      const result = compareRecipients(a, b, recipientSort.key);
      if (result !== 0) return result * direction;
      return String(a.employeeName || "").localeCompare(String(b.employeeName || ""), undefined, { sensitivity: "base" });
    });
  }, [filteredRecipients, recipientSort]);
  const toggleRecipientSort = (column) => {
    setRecipientSort((prev) => (
      prev.key === column
        ? { key: column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key: column, direction: "asc" }
    ));
  };

  const manualNeedingProof = recipients.filter(
    (recipient) =>
      isManualPaymentMethod(recipient.paymentMethod) &&
      (recipient.status !== "PAID" || !recipient.paymentProof?.hasProof)
  );
  const bankRecipients = recipients.filter(
    (recipient) =>
      recipient.status !== "BLOCKED" &&
      recipient.status !== "PAID" &&
      !isManualPaymentMethod(recipient.paymentMethod)
  );
  const manualUnpaidRecipients = recipients.filter(
    (recipient) => recipient.payoutDelivery === "manual" && recipient.status !== "PAID" && recipient.status !== "BLOCKED"
  );
  const paidRecipientCount = recipients.filter((recipient) => recipient.status === "PAID").length;
  const canRecordPayment = Boolean(canMarkPaid && detail?.status === "READY_FOR_DISBURSEMENT" && !isApprover);
  const sendReady = detail?.status === "READY_FOR_DISBURSEMENT";
  const showSendPayouts = Boolean(
    canCreate && ["READY_FOR_REVIEW", "APPROVED", "READY_FOR_DISBURSEMENT"].includes(detail?.status)
  );
  const sendBlocker = !sendReady
    ? "A second person has to approve this batch before payouts can be sent."
    : !provider
      ? "Link a company funding account before sending bank payouts."
      : manualNeedingProof.length > 0
        ? "Record check, cash, or other payments with proof before sending bank payouts."
        : bankRecipients.length === 0
          ? "No unpaid employees are set to receive a bank payout."
          : null;
  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await approveDisbursementBatch(apiUrl, token, detail.id);
      toast.success("Disbursement batch approved.");
      setApproveOpen(false);
      await loadDetail();
    } catch (error) {
      toast.error(error.message || "Failed to approve disbursement batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await cancelDisbursementBatch(apiUrl, token, detail.id);
      toast.success("Disbursement batch cancelled.");
      setCancelOpen(false);
      await loadDetail();
    } catch (error) {
      toast.error(error.message || "Failed to cancel disbursement batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelivery = async (recipient, delivery) => {
    if (delivery === "automatic") {
      setAutomaticNoticeOpen(true);
      return;
    }
    setActionLoading(true);
    try {
      await updateEmployeePayoutDelivery(apiUrl, token, recipient.employeeId, delivery);
      toast.success(`${recipient.employeeName} will be paid by check, cash, or other.`);
      await loadDetail();
    } catch (error) {
      toast.error(error.message || "Failed to update how this employee is paid");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <DisbursementFrame
        title={detail ? formatDisbursementPeriod(detail.payrollRun) : "Disbursement batch"}
        description={
          detail
            ? `${detail.recipientCount} employee${detail.recipientCount === 1 ? "" : "s"} · ${formatDisbursementCurrency(detail.totalAmount, detail.currency)}`
            : "Review who gets paid by bank and who was paid outside payroll."
        }
        actions={
          <Button variant="ghost" onClick={() => router.push("/dashboard/employee/disbursement/batches")}>
            <ArrowLeft className="h-4 w-4" />
            Batches
          </Button>
        }
      >
        {detailLoading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading batch details…
          </div>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">This disbursement batch could not be loaded.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{formatDisbursementCurrency(detail.totalAmount, detail.currency)}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold text-green-600">{paidRecipientCount} of {detail.recipientCount}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent><StatusBadge status={detail.status} /></CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
              {canApprove && detail.status === "READY_FOR_REVIEW" && !isCreator && (
                <Button
                  onClick={() => setApproveOpen(true)}
                  disabled={detail.hasBlockingErrors || actionLoading}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Check />
                  Approve Disbursement
                </Button>
              )}
              {canApprove && detail.status === "READY_FOR_REVIEW" && isCreator && (
                <span className="text-xs text-muted-foreground">Waiting for a second person to approve.</span>
              )}
              {canRecordPayment && manualUnpaidRecipients.length > 0 && (
                <Button variant="outline" onClick={() => setPaymentTarget({ recipientId: null })}>
                  <Banknote />
                  Mark all paid
                </Button>
              )}
              {showSendPayouts && (
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setAutomaticNoticeOpen(true)}
                  disabled={actionLoading}
                >
                  <Send />
                  Send payouts{bankRecipients.length > 0 ? ` (${bankRecipients.length})` : ""}
                </Button>
              )}
              {showSendPayouts && sendBlocker ? (
                <span className="text-xs text-muted-foreground">{sendBlocker}</span>
              ) : null}
              {canMarkPaid && detail.status === "READY_FOR_DISBURSEMENT" && isApprover && (
                <span className="text-xs text-muted-foreground">A different administrator must attach payment proof.</span>
              )}
              {detail.paymentProof?.hasProof && (
                <Button variant="outline" onClick={() => router.push(`/dashboard/employee/disbursement/${detail.id}/proof`)}>
                  <FileImage />
                  View payment proof
                </Button>
              )}
              </div>
              {canCreate && ["READY_FOR_REVIEW", "APPROVED", "READY_FOR_DISBURSEMENT"].includes(detail.status) && (
                <Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={actionLoading}>
                  <Ban />
                  Cancel
                </Button>
              )}
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
                      <SortableHead label="Employee" column="employee" sort={recipientSort} onSort={toggleRecipientSort} />
                      <SortableHead label="Amount" column="amount" sort={recipientSort} onSort={toggleRecipientSort} align="right" />
                      <SortableHead label="Account" column="account" sort={recipientSort} onSort={toggleRecipientSort} />
                      <SortableHead label="Status" column="status" sort={recipientSort} onSort={toggleRecipientSort} align="center" />
                      <SortableHead label="Payment" column="payment" sort={recipientSort} onSort={toggleRecipientSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRecipients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No employees match this search.</TableCell>
                      </TableRow>
                    ) : (
                      sortedRecipients.map((recipient) => {
                        const warnings = (recipient.issues || []).filter((issue) => issue.severity === "WARNING");
                        const blockers = (recipient.issues || []).filter((issue) => issue.severity === "BLOCKING");
                        return (
                          <TableRow key={recipient.id}>
                            <TableCell className="text-left">
                              <div className="font-medium">{recipient.employeeName}</div>
                              <div className="text-xs text-muted-foreground">{recipient.email || recipient.employeeNumber || recipient.employeeId}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatDisbursementCurrency(recipient.amount, recipient.currency)}</TableCell>
                            <TableCell>
                              {accountLabel(recipient)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-center gap-1">
                                <StatusBadge status={recipient.status} labels={RECIPIENT_STATUS_LABELS} />
                                {blockers.map((issue) => (
                                  <span key={`${recipient.id}-${issue.code}`} className="text-[11px] text-red-700">{issue.message}</span>
                                ))}
                                {warnings.map((issue) => (
                                  <span key={`${recipient.id}-${issue.code}`} className="text-[11px] text-amber-700">{issue.message}</span>
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
                                        onClick={() => router.push(`/dashboard/employee/disbursement/${detail.id}/recipients/${recipient.id}/proof`)}
                                      >
                                        <FileImage />
                                        View proof
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {canCreate && recipient.employeeId && !["COMPLETED", "CANCELLED", "PROCESSING"].includes(detail.status) && !["PAID", "BLOCKED"].includes(recipient.status) ? (
                                      <Select
                                        value={recipient.payoutDelivery === "manual" ? "manual" : "automatic"}
                                        onValueChange={(value) => handleDelivery(recipient, value)}
                                        disabled={actionLoading}
                                      >
                                        <SelectTrigger className="h-8 w-40">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="automatic">Automatic bank</SelectItem>
                                          <SelectItem value="manual">Manual payment</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        {recipient.payoutDelivery === "manual" ? "Manual payment" : "Automatic bank"}
                                      </span>
                                    )}
                                    {canCreate && recipient.payoutDelivery !== "manual" && !recipient.payoutAccountLinked && recipient.employeeId && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPayoutSetupId(recipient.employeeId)}
                                      >
                                        <Landmark />
                                        Set up payout account
                                      </Button>
                                    )}
                                    {canRecordPayment && recipient.payoutDelivery === "manual" && recipient.status !== "BLOCKED" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPaymentTarget({ recipientId: recipient.id })}
                                      >
                                        <Banknote />
                                        Mark paid
                                      </Button>
                                    )}
                                  </>
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
      </DisbursementFrame>

      <EmployeePayoutSetupDialog
        open={Boolean(payoutSetupId)}
        onOpenChange={(open) => {
          if (!open) setPayoutSetupId(null);
        }}
        recipient={recipients.find((row) => row.employeeId === payoutSetupId) || null}
        apiUrl={apiUrl}
        token={token}
        onSaved={loadDetail}
      />

      <RecordOutsidePaymentDialog
        open={Boolean(paymentTarget)}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null);
        }}
        detail={detail}
        recipient={paymentTarget?.recipientId ? recipients.find((row) => row.id === paymentTarget.recipientId) || null : null}
        apiUrl={apiUrl}
        token={token}
        onSaved={loadDetail}
      />

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
            <p>Payroll period: {formatDisbursementPeriod(detail?.payrollRun)}</p>
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

      <AutomaticTransferNotice open={automaticNoticeOpen} onOpenChange={setAutomaticNoticeOpen} />
    </>
  );
}
