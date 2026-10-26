"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchDisbursementBatch,
  fetchDisbursementPaymentProof,
  fetchRecipientPaymentProof,
  formatDisbursementCurrency,
  formatDisbursementDate,
  formatDisbursementPeriod,
  PAYMENT_METHOD_LABELS,
} from "@/lib/disbursementApi";
import { DisbursementFrame, useDisbursementSession } from "./disbursementUi";

function ProofFact({ label, children }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children || "—"}</dd>
    </div>
  );
}

function fileKind(mimeType) {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF";
  return "File";
}

export default function PaymentProof({ batchId, recipientId }) {
  const router = useRouter();
  const { token, apiUrl, canView } = useDisbursementSession();
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mimeType, setMimeType] = useState("");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !canView || !batchId) return undefined;
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [blob, batch] = await Promise.all([
          recipientId
            ? fetchRecipientPaymentProof(apiUrl, token, batchId, recipientId)
            : fetchDisbursementPaymentProof(apiUrl, token, batchId),
          fetchDisbursementBatch(apiUrl, token, batchId).catch(() => null),
        ]);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setMimeType(blob.type || "");
        setPreviewUrl(objectUrl);
        setDetail(batch);
      } catch (err) {
        if (!cancelled) {
          const message = err.message || "Failed to load payment proof";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiUrl, token, canView, batchId, recipientId]);

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const recipient = recipientId
    ? detail?.recipients?.find((row) => row.id === recipientId)
    : null;
  const sharedRecipients = !recipientId && detail?.paymentMarkedAt
    ? (detail.recipients || []).filter((row) => row.paymentMarkedAt === detail.paymentMarkedAt)
    : [];
  const proofMeta = recipient?.paymentProof?.hasProof ? recipient.paymentProof : detail?.paymentProof;
  const paymentMethod = recipient?.paymentMethod || detail?.paymentMethod;
  const recordedBy = recipient?.paymentMarkedBy?.name || detail?.paymentMarkedBy?.name;
  const recordedAt = recipient?.paymentMarkedAt || detail?.paymentMarkedAt;
  const summary = recipientId
    ? "An administrator attached this file when this employee was marked paid by check, cash, or another method outside BizBuddy. It is a record of that payment. No money was sent from here."
    : "An administrator attached this file when the remaining unpaid employees were marked paid together. It is a record of that payment. No money was sent from here.";

  return (
    <>
      <Toaster />
      <DisbursementFrame
        title="Payment proof"
        description={recipientId ? "Proof attached for this employee." : "Proof attached for this disbursement batch."}
        actions={
          <Button
            variant="ghost"
            className="px-0 text-orange-700 hover:text-orange-800"
            onClick={() => router.push(`/dashboard/employee/disbursement/${batchId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to batch
          </Button>
        }
      >
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading proof…
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">
              {isImage ? (
                <img src={previewUrl} alt="Payment proof" className="max-h-[70vh] max-w-full rounded-md border" />
              ) : isPdf ? (
                <iframe title="Payment proof" src={previewUrl} className="h-[70vh] w-full rounded-md border" />
              ) : (
                <a href={previewUrl} className="text-sm text-orange-700 underline" download>
                  Download payment proof
                </a>
              )}
            </div>
            <aside className="space-y-4 rounded-lg border bg-muted/40 p-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">About this proof</h2>
                <p className="text-sm text-muted-foreground">{summary}</p>
              </div>
              <dl className="space-y-3">
                <ProofFact label="Payroll period">{formatDisbursementPeriod(detail?.payrollRun)}</ProofFact>
                {recipientId ? (
                  <>
                    <ProofFact label="Employee">
                      {recipient.employeeName}
                      {recipient.employeeNumber ? ` · ${recipient.employeeNumber}` : ""}
                    </ProofFact>
                    <ProofFact label="Amount">
                      {formatDisbursementCurrency(recipient.amount, recipient.currency || detail?.currency)}
                    </ProofFact>
                  </>
                ) : (
                  <ProofFact label="Employees on this proof">
                    {sharedRecipients.length > 0 ? (
                      <span className="block max-h-40 space-y-1 overflow-auto">
                        {sharedRecipients.map((row) => (
                          <span key={row.id} className="block">
                            {row.employeeName}
                            {row.employeeNumber ? ` · ${row.employeeNumber}` : ""}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "The employees marked paid with this file"
                    )}
                  </ProofFact>
                )}
                <ProofFact label="How it was paid">{PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod}</ProofFact>
                <ProofFact label="Recorded by">{recordedBy}</ProofFact>
                <ProofFact label="Recorded on">{formatDisbursementDate(recordedAt)}</ProofFact>
                <ProofFact label="File">
                  {proofMeta?.fileName || "Payment proof"}
                  {mimeType ? ` · ${fileKind(mimeType)}` : ""}
                </ProofFact>
              </dl>
              {previewUrl ? (
                <a href={previewUrl} download={proofMeta?.fileName || "payment-proof"} className="text-sm text-orange-700 underline">
                  Download
                </a>
              ) : null}
            </aside>
          </div>
        )}
      </DisbursementFrame>
    </>
  );
}
