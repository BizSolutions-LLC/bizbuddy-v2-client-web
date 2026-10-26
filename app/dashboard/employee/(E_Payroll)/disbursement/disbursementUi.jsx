"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import useAuthStore from "@/store/useAuthStore";
import {
  canApproveDisbursement,
  canCreateDisbursement,
  canMarkPaymentSent,
  canViewDisbursement,
  DISBURSEMENT_STATUS_LABELS,
  disbursementStatusClass,
} from "@/lib/disbursementApi";

export const PROOF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf";
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

export function isAllowedProofFile(file) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return (
    ["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type) ||
    [".png", ".jpg", ".jpeg", ".webp", ".pdf"].some((ext) => name.endsWith(ext))
  );
}

export function AutomaticTransferNotice({ open, onOpenChange }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Automatic transfers</AlertDialogTitle>
          <AlertDialogDescription>
            Automatic transfers are still under development. Contact BizBuddy for more information.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function StatusBadge({ status, labels = DISBURSEMENT_STATUS_LABELS }) {
  return (
    <Badge variant="outline" className={disbursementStatusClass(status)}>
      {labels[status] || status || "Unknown"}
    </Badge>
  );
}

export function DisbursementFrame({ title, description, actions, children }) {
  return (
    <div className="min-w-0 p-3 sm:p-6">
      <div className="min-w-0 space-y-6 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function useDisbursementSession({ allowEmployee = false } = {}) {
  const { token } = useAuthStore();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${apiUrl}/api/account/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (cancelled) return;
        const nextRole = payload?.data?.user?.role?.toLowerCase() || null;
        setRole(nextRole);
        setUserId(payload?.data?.user?.id || null);
        setProfile(payload?.data || null);
        setReady(true);
        if (nextRole === "employee") {
          if (!allowEmployee) router.replace("/dashboard/employee/disbursement/my-payout-account");
          return;
        }
        if (!canViewDisbursement(nextRole)) {
          toast.error("Access denied. Disbursement is limited to payroll administrators.");
          router.push("/dashboard/employee/payroll");
        }
      } catch {
        if (!cancelled) {
          setReady(true);
          toast.error("Failed to load your account.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, token, router, allowEmployee]);

  return {
    token,
    apiUrl,
    role,
    userId,
    profile,
    ready,
    canView: canViewDisbursement(role),
    canCreate: canCreateDisbursement(role),
    canApprove: canApproveDisbursement(role),
    canMarkPaid: canMarkPaymentSent(role),
  };
}
