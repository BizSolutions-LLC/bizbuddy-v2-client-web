"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "sonner";
import { Banknote, CheckCircle2, Clock, Loader2, Users, Wallet, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDisbursementFromPayrollRun,
  fetchDisbursementBatches,
  fetchDisbursementSummary,
  fetchPayoutProvider,
  formatDisbursementCurrency,
  formatDisbursementDay,
} from "@/lib/disbursementApi";
import { DisbursementFrame, useDisbursementSession } from "./disbursementUi";

export default function Overview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useDisbursementSession();
  const { token, apiUrl, canView, canCreate } = session;
  const [summary, setSummary] = useState(null);
  const [providerState, setProviderState] = useState({ provider: null, configured: false });
  const [loading, setLoading] = useState(true);
  const [eligibleRuns, setEligibleRuns] = useState([]);
  const [createRunId, setCreateRunId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const batchId = searchParams.get("batchId");
    if (batchId) router.replace(`/dashboard/employee/disbursement/${batchId}`);
  }, [searchParams, router]);

  const loadDashboard = useCallback(async () => {
    if (!token || !canView) return;
    setLoading(true);
    try {
      const [summaryData, providerData] = await Promise.all([
        fetchDisbursementSummary(apiUrl, token),
        fetchPayoutProvider(apiUrl, token).catch(() => ({ provider: null, configured: false })),
      ]);
      setSummary(summaryData);
      setProviderState({
        provider: providerData?.provider || null,
        configured: Boolean(providerData?.configured),
      });
    } catch (error) {
      toast.error(error.message || "Failed to load disbursements");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, canView]);

  const loadEligibleRuns = useCallback(async () => {
    if (!token || !canCreate) return;
    try {
      const [runsRes, listData] = await Promise.all([
        fetch(`${apiUrl}/api/payroll-system/payroll-runs?status=finalized&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchDisbursementBatches(apiUrl, token, { limit: 200 }),
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
  }, [apiUrl, token, canCreate]);

  useEffect(() => {
    if (canView) {
      loadDashboard();
      loadEligibleRuns();
    }
  }, [canView, loadDashboard, loadEligibleRuns]);

  const handleCreate = async () => {
    if (!createRunId) return;
    setActionLoading(true);
    try {
      const created = await createDisbursementFromPayrollRun(apiUrl, token, createRunId);
      toast.success("Disbursement batch created from finalized payroll.");
      router.push(`/dashboard/employee/disbursement/${created.id}`);
    } catch (error) {
      toast.error(error.message || "Failed to create disbursement batch");
    } finally {
      setActionLoading(false);
    }
  };

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
      hint: "Open company payout account",
      icon: Users,
      color: "text-amber-600",
      href: "/dashboard/employee/disbursement/payout-accounts",
    },
    {
      label: "Awaiting approval",
      value: summary?.batchesAwaitingApproval ?? "—",
      hint: "Ready for review",
      icon: Clock,
      color: "text-orange-600",
      href: "/dashboard/employee/disbursement/batches?status=READY_FOR_REVIEW",
    },
    {
      label: "Ready for submission",
      value: summary?.batchesReadyForSubmission ?? "—",
      hint: "Approved and ready to pay",
      icon: CheckCircle2,
      color: "text-green-600",
      href: "/dashboard/employee/disbursement/batches?status=READY_FOR_DISBURSEMENT",
    },
    {
      label: "Completed batches",
      value: summary?.completedBatches ?? "—",
      hint: "Payout recorded or confirmed",
      icon: CheckCircle2,
      color: "text-green-600",
      href: "/dashboard/employee/disbursement/batches?status=COMPLETED",
    },
    {
      label: "Failed / exception batches",
      value: summary?.failedOrExceptionBatches ?? "—",
      hint: "Failed or needs review",
      icon: XCircle,
      color: "text-red-600",
      href: "/dashboard/employee/disbursement/batches?status=exceptions",
    },
  ];

  return (
    <>
      <Toaster />
      <DisbursementFrame
        title="Disbursement"
        description={
          providerState.provider
            ? "Review a finalized payroll, record payments made outside the bank, and send the rest once accounts are verified."
            : providerState.configured
              ? "Link a Moov or Stripe funding account before sending bank payouts."
              : "Review finalized payroll here. Bank payouts stay off until a payment provider is configured."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canCreate ? (
              <Button variant="outline" onClick={() => router.push("/dashboard/employee/disbursement/payout-accounts")}>
                Company funding
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => router.push("/dashboard/employee/disbursement/batches")}>
              View batches
            </Button>
          </div>
        }
      >
        {canCreate ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Start a disbursement</CardTitle>
              <CardDescription>Choose a locked, finalized payroll that does not already have an open batch.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={createRunId || undefined} onValueChange={setCreateRunId} disabled={eligibleRuns.length === 0}>
                <SelectTrigger className="w-full sm:max-w-md">
                  <SelectValue placeholder={eligibleRuns.length === 0 ? "No payroll is ready" : "Select finalized payroll"} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {formatDisbursementDay(run.periodStart)} – {formatDisbursementDay(run.periodEnd)} · {formatDisbursementCurrency(run.totalNet)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleCreate}
                disabled={!createRunId || actionLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create batch
              </Button>
            </CardContent>
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const body = (
              <Card className={stat.href ? "h-full transition-colors hover:border-orange-300" : "h-full"}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stat.color}`}>{loading ? "—" : stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.hint}</p>
                </CardContent>
              </Card>
            );
            if (!stat.href) return <div key={stat.label}>{body}</div>;
            return (
              <button key={stat.label} type="button" className="text-left" onClick={() => router.push(stat.href)}>
                {body}
              </button>
            );
          })}
        </div>
      </DisbursementFrame>
    </>
  );
}
