"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Loader2, Search } from "lucide-react";
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
  DISBURSEMENT_STATUS_LABELS,
  fetchDisbursementBatches,
  formatDisbursementCurrency,
  formatDisbursementDay,
  formatDisbursementPeriod,
} from "@/lib/disbursementApi";
import { DisbursementFrame, StatusBadge, useDisbursementSession } from "./disbursementUi";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "READY_FOR_REVIEW", label: DISBURSEMENT_STATUS_LABELS.READY_FOR_REVIEW },
  { value: "READY_FOR_DISBURSEMENT", label: DISBURSEMENT_STATUS_LABELS.READY_FOR_DISBURSEMENT },
  { value: "PROCESSING", label: DISBURSEMENT_STATUS_LABELS.PROCESSING },
  { value: "COMPLETED", label: DISBURSEMENT_STATUS_LABELS.COMPLETED },
  { value: "FAILED", label: DISBURSEMENT_STATUS_LABELS.FAILED },
  { value: "NEEDS_REVIEW", label: DISBURSEMENT_STATUS_LABELS.NEEDS_REVIEW },
  { value: "exceptions", label: "Failed or needs review" },
  { value: "CANCELLED", label: DISBURSEMENT_STATUS_LABELS.CANCELLED },
];

export default function BatchList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "ALL";
  const session = useDisbursementSession();
  const { token, apiUrl, canView } = session;
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchSearch, setBatchSearch] = useState("");

  const loadBatches = useCallback(async () => {
    if (!token || !canView) return;
    setLoading(true);
    try {
      if (status === "exceptions") {
        const [failed, review] = await Promise.all([
          fetchDisbursementBatches(apiUrl, token, { status: "FAILED", limit: 100 }),
          fetchDisbursementBatches(apiUrl, token, { status: "NEEDS_REVIEW", limit: 100 }),
        ]);
        const merged = [...(failed?.batches || []), ...(review?.batches || [])];
        merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setBatches(merged);
      } else {
        const listData = await fetchDisbursementBatches(apiUrl, token, {
          status: status === "ALL" ? undefined : status,
          limit: 100,
        });
        setBatches(listData?.batches || []);
      }
    } catch (error) {
      toast.error(error.message || "Failed to load disbursements");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, canView, status]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const filteredBatches = useMemo(() => {
    if (!batchSearch.trim()) return batches;
    const q = batchSearch.trim().toLowerCase();
    return batches.filter((batch) => {
      const period = formatDisbursementPeriod(batch.payrollRun).toLowerCase();
      return (
        batch.id.toLowerCase().includes(q) ||
        period.includes(q) ||
        (DISBURSEMENT_STATUS_LABELS[batch.status] || batch.status || "").toLowerCase().includes(q) ||
        (batch.createdBy?.name || "").toLowerCase().includes(q)
      );
    });
  }, [batches, batchSearch]);

  const setStatus = (next) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!next || next === "ALL") params.delete("status");
    else params.set("status", next);
    const query = params.toString();
    router.replace(query ? `/dashboard/employee/disbursement/batches?${query}` : "/dashboard/employee/disbursement/batches");
  };

  return (
    <>
      <Toaster />
      <DisbursementFrame
        title="Disbursement batches"
        description="Open a payroll period to review recipients, record an outside payment, or send bank payouts."
        actions={
          <Button variant="ghost" onClick={() => router.push("/dashboard/employee/disbursement")}>
            <ArrowLeft className="h-4 w-4" />
            Overview
          </Button>
        }
      >
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Batches</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={batchSearch}
                  onChange={(event) => setBatchSearch(event.target.value)}
                  placeholder="Search batches…"
                  className="pl-8"
                />
              </div>
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
                No disbursement batches match this view.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Payroll period</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-left">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => (
                    <TableRow
                      key={batch.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/employee/disbursement/${batch.id}`)}
                    >
                      <TableCell className="text-left">
                        <div className="font-medium text-foreground">{formatDisbursementPeriod(batch.payrollRun)}</div>
                        <div className="text-xs text-muted-foreground">{batch.createdBy?.name || "Unknown"}</div>
                      </TableCell>
                      <TableCell>{batch.recipientCount}</TableCell>
                      <TableCell className="text-right font-medium">{formatDisbursementCurrency(batch.totalAmount, batch.currency)}</TableCell>
                      <TableCell><StatusBadge status={batch.status} /></TableCell>
                      <TableCell className="text-left text-muted-foreground">{formatDisbursementDay(batch.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </DisbursementFrame>
    </>
  );
}
