"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileImage, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDisbursementCurrency,
  MANUAL_PAYMENT_METHODS,
  markDisbursementPaid,
  markRecipientPaymentSent,
  PAYMENT_METHOD_LABELS,
} from "@/lib/disbursementApi";
import { isAllowedProofFile, PROOF_ACCEPT, PROOF_MAX_BYTES } from "./disbursementUi";

export default function RecordOutsidePaymentDialog({
  open,
  onOpenChange,
  detail,
  recipient,
  apiUrl,
  token,
  onSaved,
}) {
  const [paymentMethod, setPaymentMethod] = useState("CHECK");
  const [proofFile, setProofFile] = useState(null);
  const [proofDragActive, setProofDragActive] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const proofInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPaymentMethod("CHECK");
    setProofFile(null);
    setProofDragActive(false);
  }, [open, recipient?.id]);

  const unpaidPayableRecipients = (detail?.recipients || []).filter(
    (row) => row.payoutDelivery === "manual" && row.status !== "PAID" && row.status !== "BLOCKED"
  );

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
    if (!proofFile || !detail) {
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
        toast.success(`Payment recorded for ${recipient.employeeName}. No bank transfer was made.`);
      } else {
        await markDisbursementPaid(apiUrl, token, detail.id, {
          paymentMethod,
          file: proofFile,
        });
        toast.success("Outside payments recorded. No bank transfer was made.");
      }
      onOpenChange(false);
      await onSaved?.();
    } catch (error) {
      toast.error(error.message || "Failed to record the payment");
    } finally {
      setActionLoading(false);
    }
  };

  const amountLabel = recipient
    ? formatDisbursementCurrency(recipient.amount, recipient.currency || detail?.currency)
    : formatDisbursementCurrency(
        unpaidPayableRecipients.reduce((sum, row) => sum + (row.amount || 0), 0),
        detail?.currency
      );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {recipient ? `Mark ${recipient.employeeName} paid` : "Mark all paid"}
          </DialogTitle>
          <DialogDescription>
            This records a check, cash, or other payment already made outside BizBuddy. It does not transfer money.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">{recipient ? "Amount" : "Remaining total"}</p>
            <p className="text-lg font-semibold text-foreground">{amountLabel}</p>
            {!recipient ? (
              <p className="text-xs text-muted-foreground">
                {unpaidPayableRecipients.length} employee{unpaidPayableRecipients.length === 1 ? "" : "s"} set to manual payment will share this method and proof.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outside-payment-method">Payment sent via</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="outside-payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_PAYMENT_METHODS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PAYMENT_METHOD_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outside-payment-proof">Proof of payment</Label>
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
              className={`rounded-lg border border-dashed p-4 text-center cursor-pointer transition-colors ${
                proofDragActive ? "border-primary bg-accent" : "border-border hover:border-primary/60"
              }`}
            >
              <input
                ref={proofInputRef}
                id="outside-payment-proof"
                type="file"
                accept={PROOF_ACCEPT}
                className="hidden"
                onChange={(event) => applyProofFile(event.target.files?.[0] || null)}
              />
              {proofFile ? (
                <div className="space-y-1">
                  <FileImage className="mx-auto h-6 w-6 text-green-600" />
                  <p className="text-sm font-medium">{proofFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(proofFile.size / 1024).toFixed(1)} KB</p>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
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
                  <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Drop a screenshot here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or PDF · up to 5MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={actionLoading || !proofFile || (!recipient && unpaidPayableRecipients.length === 0)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Mark paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
