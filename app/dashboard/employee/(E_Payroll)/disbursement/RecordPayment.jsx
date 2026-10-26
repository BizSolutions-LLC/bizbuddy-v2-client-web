"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "sonner";
import { ArrowLeft, FileImage, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchDisbursementBatch,
  formatDisbursementCurrency,
  MANUAL_PAYMENT_METHODS,
  markDisbursementPaid,
  markRecipientPaymentSent,
  PAYMENT_METHOD_LABELS,
} from "@/lib/disbursementApi";
import {
  DisbursementFrame,
  isAllowedProofFile,
  PROOF_ACCEPT,
  PROOF_MAX_BYTES,
  useDisbursementSession,
} from "./disbursementUi";

export default function RecordPayment({ batchId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipientId = searchParams.get("recipientId");
  const session = useDisbursementSession();
  const { token, apiUrl, userId, canView, canMarkPaid } = session;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("CHECK");
  const [proofFile, setProofFile] = useState(null);
  const [proofDragActive, setProofDragActive] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const proofInputRef = useRef(null);

  const loadDetail = useCallback(async () => {
    if (!token || !canView || !batchId) return;
    setLoading(true);
    try {
      setDetail(await fetchDisbursementBatch(apiUrl, token, batchId));
    } catch (error) {
      toast.error(error.message || "Failed to load disbursement batch");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, canView, batchId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const recipient = useMemo(
    () => (detail?.recipients || []).find((row) => row.id === recipientId) || null,
    [detail, recipientId]
  );
  const unpaidPayableRecipients = (detail?.recipients || []).filter(
    (row) => row.payoutDelivery === "manual" && row.status !== "PAID" && row.status !== "BLOCKED"
  );
  const isApprover = Boolean(detail?.approvedById && userId && detail.approvedById === userId);
  const canRecord = Boolean(canMarkPaid && detail?.status === "READY_FOR_DISBURSEMENT" && !isApprover);
  const backHref = `/dashboard/employee/disbursement/${batchId}`;

  const applyProofFile = (file) => {
    if (!file) {
      setProofFile(null);
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

  const handleSubmit = async () => {
    if (!proofFile) {
      toast.error("Attach a screenshot as proof of payment.");
      return;
    }
    setActionLoading(true);
    try {
      if (recipient) {
        await markRecipientPaymentSent(apiUrl, token, detail.id, recipient.id, {
          paymentMethod,
          file: proofFile,
        });
        toast.success(`Payment marked as sent for ${recipient.employeeName}. No bank transfer was made from this app.`);
      } else {
        await markDisbursementPaid(apiUrl, token, detail.id, {
          paymentMethod,
          file: proofFile,
        });
        toast.success("Payment marked as sent. No bank transfer was made from this app.");
      }
      setProofFile(null);
      router.push(backHref);
    } catch (error) {
      toast.error(error.message || "Failed to mark payment sent");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <DisbursementFrame
        title={recipient ? `Mark ${recipient.employeeName} paid` : "Mark all paid"}
        description="Record that this payroll was paid outside BizBuddy. This does not transfer money. A screenshot of the check, cash receipt, or other proof is required."
        actions={
          <Button variant="ghost" className="px-0 text-orange-700 hover:text-orange-800" onClick={() => router.push(backHref)}>
            <ArrowLeft className="h-4 w-4" />
            Back to batch
          </Button>
        }
      >
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading batch…
          </div>
        ) : !detail || (recipientId && !recipient) ? (
          <p className="text-sm text-muted-foreground">This payment could not be loaded.</p>
        ) : !canRecord ? (
          <p className="text-sm text-muted-foreground">
            Outside payment can be recorded by an administrator who did not approve this batch, while it is ready for disbursement.
          </p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment proof</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {recipient ? (
                <p>Amount: {formatDisbursementCurrency(recipient.amount, recipient.currency)}</p>
              ) : (
                <>
                  <p>Remaining recipients: {unpaidPayableRecipients.length}</p>
                  <p>
                    Remaining total:{" "}
                    {formatDisbursementCurrency(
                      unpaidPayableRecipients.reduce((sum, row) => sum + (row.amount || 0), 0),
                      detail.currency
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    This marks every remaining employee set to manual payment with the same method and proof. Employees set to automatic bank are left unpaid.
                  </p>
                </>
              )}
              <div className="space-y-1 max-w-sm">
                <label className="text-sm font-medium" htmlFor="payment-method">Payment sent via</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_PAYMENT_METHODS.map((value) => (
                      <SelectItem key={value} value={value}>{PAYMENT_METHOD_LABELS[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  className={`max-w-lg rounded-lg border-2 border-dashed p-5 text-center space-y-2 cursor-pointer transition-colors ${
                    proofDragActive ? "border-orange-500 bg-orange-50" : "border-muted-foreground/25 hover:border-orange-400"
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
                      <p className="text-xs text-muted-foreground">{(proofFile.size / 1024).toFixed(1)} KB</p>
                      <button
                        type="button"
                        className="text-sm text-orange-600 hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setProofFile(null);
                          if (proofInputRef.current) proofInputRef.current.value = "";
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-7 w-7 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Drag a screenshot here, or click to browse</p>
                      <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or PDF · up to 5MB</p>
                    </>
                  )}
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={actionLoading || !proofFile || (!recipient && unpaidPayableRecipients.length === 0)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Mark paid
              </Button>
            </CardContent>
          </Card>
        )}
      </DisbursementFrame>
    </>
  );
}
