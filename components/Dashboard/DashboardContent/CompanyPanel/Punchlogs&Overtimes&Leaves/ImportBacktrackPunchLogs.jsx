/* components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/ImportBacktrackPunchLogs.jsx */
"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Loader2,
  FileSpreadsheet,
  XCircle,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MultiSelect from "@/components/common/MultiSelect";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FREQUENCY_LABELS = {
  "bi-weekly": "Bi-Weekly",
  "bi-monthly": "Bi-Monthly",
  monthly: "Monthly",
};

const fmtSuggestedDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Shorter than fmtSuggestedDate (no year) — used in the review table where every row
// falls within the same reviewed period and horizontal space is tight.
const fmtRowDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const STATUS_BADGE = {
  ready:               "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400",
  conflict:            "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400",
  "unresolved-employee": "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400",
  error:               "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400",
  informational:       "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400",
};

const STATUS_LABEL = {
  ready: "Ready",
  conflict: "Conflict",
  "unresolved-employee": "Unresolved",
  error: "Error",
  informational: "Informational",
};

const MATCH_BADGE = {
  "matched-fuzzy": "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
  unresolved:     "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400",
};

// Full row tint so a row's severity reads at a glance without reading the status badge:
// green = ready to import, red = blocked (conflict/error), blue = likely a leave day
// (informational, no punch records), amber = needs an employee picked before it can import.
const STATUS_ROW_COLOR = {
  ready: "bg-green-50/60 border-l-2 border-l-green-400 dark:bg-green-950/10",
  conflict: "bg-red-50/60 border-l-2 border-l-red-400 dark:bg-red-950/10",
  error: "bg-red-50/60 border-l-2 border-l-red-400 dark:bg-red-950/10",
  informational: "bg-blue-50/60 border-l-2 border-l-blue-400 dark:bg-blue-950/10",
  "unresolved-employee": "bg-amber-50/60 border-l-2 border-l-amber-400 dark:bg-amber-950/10",
};

const employeeFullName = (e) =>
  `${e.profile?.firstName || ""} ${e.profile?.lastName || ""}`.trim() || e.email?.split("@")[0] || e.id;

// records[].timeIn/timeOut come back as UTC ISO strings — same formatter EmployeesPunchLogs.jsx
// uses for its own timeIn/timeOut display, so backtrack times read the same as everywhere else.
const safeTime = (d, timezone = "UTC") =>
  d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: timezone }) : "—";

const PUNCH_TYPE_LABEL = {
  REGULAR: "Regular",
  DRIVER_AIDE_AM: "Driver/Aide AM",
  DRIVER_AIDE_PM: "Driver/Aide PM",
};

// A day with both AM and PM hours produces 2 synthetic records under the hood (a technical
// necessity — a single punch can only vary its first/last segment), but the preview response
// still groups them under one entries[] item. Flatten records[].segments into one object per
// row so the review table can show Regular/AM/PM side by side without the admin ever seeing
// the underlying record split.
const flattenSegments = (entry) => {
  const merged = {};
  (entry.records || []).forEach((rec) => {
    const segs = rec.segments || {};
    if (segs.regular) merged.regular = segs.regular;
    if (segs.driverAm) merged.driverAm = segs.driverAm;
    if (segs.driverPm) merged.driverPm = segs.driverPm;
  });
  return merged;
};

const resolvedUserId = (entry) => entry.overrideUserId || entry.employeeMatch?.userId || null;
const isUnresolved = (entry) => entry.employeeMatch?.status === "unresolved" && !resolvedUserId(entry);

function SegmentCell({ label, segment }) {
  if (!segment) return <span className="text-muted-foreground">—</span>;
  const { target, predicted, capped, maxAchievableHours } = segment;
  return (
    <div className="text-xs whitespace-nowrap">
      <span className="font-medium text-muted-foreground">{label}</span>{" "}
      <span>{target}h</span>
      <span className="text-muted-foreground"> → </span>
      <span className={predicted !== target ? "font-semibold" : ""}>{predicted ?? "—"}h</span>
      {capped && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-1 inline-flex items-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs">
              Capped — shift window can only hold up to {maxAchievableHours}h.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export default function ImportBacktrackPunchLogs({
  open,
  onOpenChange,
  cutoffPeriods = [],
  departments = [],
  employees = [],
  currentUserRole,
  companyTimezone = "UTC",
  onImportComplete,
  onCutoffPeriodCreated,
}) {
  const { token, user } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [expandedRow, setExpandedRow] = useState(null);

  // "setup" | "uploading" | "needsPeriod" | "preview" | "confirming" | "summary"
  const [step, setStep] = useState("setup");
  const [file, setFile] = useState(null);
  const [pickedCutoffPeriodId, setPickedCutoffPeriodId] = useState(""); // admin's optional upfront pick
  const [cutoffPeriodId, setCutoffPeriodId] = useState(""); // whatever the server actually resolved (auto-matched, picked, or newly created)
  const [setupError, setSetupError] = useState(null);
  const [previewEntries, setPreviewEntries] = useState([]);
  const [period, setPeriod] = useState(null);
  const [suggestedRange, setSuggestedRange] = useState(null); // { periodStart, periodEnd }
  const [creatingPeriod, setCreatingPeriod] = useState(false);
  const [createPeriodError, setCreatePeriodError] = useState(null);
  const [createPeriodForm, setCreatePeriodForm] = useState({ paymentDate: "", frequency: "bi-weekly" });
  const [confirmResult, setConfirmResult] = useState(null);
  const [confirmError, setConfirmError] = useState(null);

  const isReviewStep = step === "preview" || step === "confirming";

  // Mirrors the server's own auto-match scoping: a supervisor's created period defaults to
  // their own department (so it's actually matchable next time), admin/superadmin default to
  // company-wide. Derived from the employee list rather than a new endpoint — the current
  // user appears in it like any other employee.
  const isSupervisor = (currentUserRole || "").toLowerCase() === "supervisor";
  const ownDepartmentId = useMemo(
    () => (isSupervisor ? employees.find((e) => e.id === user?.id)?.departmentId || null : null),
    [isSupervisor, employees, user?.id]
  );

  // Cutoff periods come back one record per department for the same pay period, and the
  // endpoint takes a single cutoffPeriodId — so unlike the report-generation dropdown, this
  // list is intentionally NOT grouped by period range; each open department record is its own
  // selectable option.
  const openPeriods = useMemo(() => cutoffPeriods.filter((p) => p.status === "open"), [cutoffPeriods]);
  const departmentName = (departmentId) => departments.find((d) => d.id === departmentId)?.name || "Company-wide";
  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: employeeFullName(e) })),
    [employees]
  );

  const resetState = () => {
    setStep("setup");
    setFile(null);
    setPickedCutoffPeriodId("");
    setCutoffPeriodId("");
    setSetupError(null);
    setPreviewEntries([]);
    setPeriod(null);
    setSuggestedRange(null);
    setCreatingPeriod(false);
    setCreatePeriodError(null);
    setCreatePeriodForm({ paymentDate: "", frequency: "bi-weekly" });
    setConfirmResult(null);
    setConfirmError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDialogOpenChange = (nextOpen) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  };

  const handleFileSelect = (e) => {
    setSetupError(null);
    setFile(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setSetupError("Please select a .csv file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setSetupError("File exceeds the 5MB size limit.");
      return;
    }

    setStep("uploading");
    setSetupError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (pickedCutoffPeriodId) formData.append("cutoffPeriodId", pickedCutoffPeriodId);

    try {
      const res = await fetch(`${API_URL}/api/backtrack-punch-log-import/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => null);

      if (res.status === 400) {
        setSetupError(json?.message || "Preview failed.");
        setStep("setup");
        return;
      }
      if (res.ok) {
        const entries = (json?.data?.entries || []).map((entry) => ({
          ...entry,
          skip: entry.status !== "ready",
          overrideUserId: null,
        }));
        setPreviewEntries(entries);
        setPeriod(json?.data?.period || null);
        setCutoffPeriodId(json?.data?.cutoffPeriodId || "");

        if (json?.data?.needsCutoffPeriod) {
          setSuggestedRange({
            periodStart: json?.data?.suggestedPeriodStart || "",
            periodEnd: json?.data?.suggestedPeriodEnd || "",
          });
          setStep("needsPeriod");
        } else {
          setStep("preview");
        }
        return;
      }
      setSetupError(json?.message || `Unexpected error (${res.status}).`);
      setStep("setup");
    } catch {
      setSetupError("Network error — please try again.");
      setStep("setup");
    }
  };

  const handleCreatePeriodAndContinue = async () => {
    if (!createPeriodForm.paymentDate || !suggestedRange?.periodStart || !suggestedRange?.periodEnd) return;
    setCreatingPeriod(true);
    setCreatePeriodError(null);
    try {
      const res = await fetch(`${API_URL}/api/cutoff-periods/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          departmentId: ownDepartmentId,
          periodStart: suggestedRange.periodStart,
          periodEnd: suggestedRange.periodEnd,
          paymentDate: createPeriodForm.paymentDate,
          frequency: createPeriodForm.frequency,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setCreatePeriodError(json?.message || "Failed to create cutoff period.");
        return;
      }
      const newId = json?.data?.id;
      setCutoffPeriodId(newId || "");
      onCutoffPeriodCreated?.();
      // Entries were already parsed against the file's own dates in the first preview call —
      // no need to re-upload/re-parse, just carry the new period id straight into confirm.
      setStep("preview");
    } catch {
      setCreatePeriodError("Network error — please try again.");
    } finally {
      setCreatingPeriod(false);
    }
  };

  const handleSkipToggle = (index, skip) => {
    setPreviewEntries((prev) => prev.map((e, i) => (i === index ? { ...e, skip } : e)));
  };

  // Assigning an employee is treated as "fixing" the row, so it also clears the default
  // exclusion — the admin can still re-check "Skip" afterward if they change their mind.
  const handleEmployeeOverride = (index, userId) => {
    setPreviewEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, overrideUserId: userId || null, skip: userId ? false : e.skip } : e))
    );
  };

  const handleBack = () => {
    setStep("setup");
    setPreviewEntries([]);
    setPeriod(null);
    setSuggestedRange(null);
    setCreatePeriodError(null);
    setCutoffPeriodId("");
  };

  const includedCount = useMemo(
    () => previewEntries.filter((e) => e.status !== "error" && !e.skip).length,
    [previewEntries]
  );
  const hasBlockingUnresolved = useMemo(
    () => previewEntries.some((e) => !e.skip && isUnresolved(e)),
    [previewEntries]
  );
  const includableEntries = useMemo(() => previewEntries.filter((e) => e.status !== "error"), [previewEntries]);
  const allIncludableSelected = includableEntries.length > 0 && includableEntries.every((e) => !e.skip);

  const handleSelectAllToggle = (checked) => {
    setPreviewEntries((prev) => prev.map((e) => (e.status === "error" ? e : { ...e, skip: !checked })));
  };

  const handleConfirm = async () => {
    setStep("confirming");
    setConfirmError(null);
    try {
      const entries = previewEntries.map((e) => ({
        csvRowNumber: e.csvRowNumber,
        rawName: e.rawName,
        date: e.date,
        regularHours: e.regularHours,
        amHours: e.amHours,
        pmHours: e.pmHours,
        skip: e.skip,
        ...(resolvedUserId(e) ? { userId: resolvedUserId(e) } : {}),
      }));

      const res = await fetch(`${API_URL}/api/backtrack-punch-log-import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cutoffPeriodId, entries }),
      });
      const json = await res.json().catch(() => null);

      if (res.ok || res.status === 207) {
        setConfirmResult({
          message: json?.message || "",
          created: json?.data?.created || [],
          failed: json?.data?.failed || [],
          conflicted: json?.data?.conflicted || [],
          approvalsSynced: json?.data?.approvalsSynced ?? 0,
        });
        setStep("summary");
        onImportComplete?.();
        return;
      }
      setConfirmError(json?.message || `Something went wrong (status ${res.status}).`);
      setStep("preview");
    } catch {
      setConfirmError("Network error — please try again.");
      setStep("preview");
    }
  };

  const handleGoToReview = () => {
    handleDialogOpenChange(false);
    router.push(`/dashboard/company/cutoff-periods/${cutoffPeriodId}/review`);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={`${isReviewStep || step === "summary" ? "sm:max-w-5xl" : "sm:max-w-lg"} border-2 dark:border-white/10`}>
        <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500 text-white shadow">
              <History className="h-4 w-4" />
            </div>
            {step === "summary"
              ? "Import Complete"
              : step === "needsPeriod"
              ? "Create a Cutoff Period"
              : isReviewStep
              ? "Review Backtrack Import"
              : "Import Backtrack Punch Logs"}
          </DialogTitle>
          <DialogDescription>
            {step === "summary"
              ? "Here's what was imported. These records still need approval before they count toward payroll."
              : step === "needsPeriod"
              ? "The file's dates aren't covered by any open Cutoff Period yet — create one to continue."
              : isReviewStep
              ? period
                ? `Reviewing entries for ${period.label}. Rows default to excluded unless they're ready — review before confirming.`
                : "Review entries before confirming."
              : "Upload a legacy CSV to backfill historical punches against an open Cutoff Period — one will be auto-detected or created for you."}
          </DialogDescription>
        </DialogHeader>

        {step === "setup" && (
          <div className="space-y-4">
            {setupError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{setupError}</AlertDescription>
              </Alert>
            )}

            {openPeriods.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Target Cutoff Period</p>
                <Select value={pickedCutoffPeriodId} onValueChange={setPickedCutoffPeriodId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Auto-detect from the file's dates" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {openPeriods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {departmentName(p.departmentId)} · {new Date(p.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" – "}
                        {new Date(p.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optional — leave blank to auto-detect an open period that covers the file's dates. If none
                  covers it, you'll be prompted to create one.
                </p>
              </div>
            )}

            <div className="rounded-lg border-2 border-dashed p-6 text-center space-y-3">
              <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose CSV File
              </Button>
              {file && (
                <p className="text-sm text-muted-foreground">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This is a DayCare-only, historical backfill flow. Up to 1000 employee×day units per file. Imported
                records need explicit approval afterward — nothing is auto-approved.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "uploading" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading and matching {file?.name}…
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-orange-500 h-2 rounded-full animate-pulse w-full" />
            </div>
          </div>
        )}

        {step === "needsPeriod" && (
          <div className="space-y-4">
            {createPeriodError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{createPeriodError}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No open Cutoff Period covers {fmtSuggestedDate(suggestedRange?.periodStart)} – {fmtSuggestedDate(suggestedRange?.periodEnd)}.
                Create one to continue — the range is fixed to what the file needs.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Period Range</Label>
                <p className="text-sm h-9 flex items-center px-3 rounded-md border bg-muted/50">
                  {fmtSuggestedDate(suggestedRange?.periodStart)} – {fmtSuggestedDate(suggestedRange?.periodEnd)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Payment Date <span className="text-orange-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={createPeriodForm.paymentDate}
                  onChange={(e) => setCreatePeriodForm((f) => ({ ...f, paymentDate: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Frequency</Label>
              <Select
                value={createPeriodForm.frequency}
                onValueChange={(v) => setCreatePeriodForm((f) => ({ ...f, frequency: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              This will be created as {isSupervisor ? "a department-scoped" : "a company-wide"} Cutoff Period.
            </p>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {confirmError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{confirmError}</AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{includedCount}</span> of {previewEntries.length} rows
              will be imported
            </p>

            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-[23%] text-left">Employee</TableHead>
                    <TableHead className="w-[12%]">Date</TableHead>
                    <TableHead className="w-[15%]">Time</TableHead>
                    <TableHead className="w-[13%]">Segments</TableHead>
                    <TableHead className="w-[15%]">Status</TableHead>
                    <TableHead className="w-[10%]">
                      <div className="flex items-center justify-center gap-1.5">
                        <Checkbox
                          checked={allIncludableSelected}
                          onCheckedChange={handleSelectAllToggle}
                          className="h-4 w-4"
                          aria-label="Select all includable rows"
                        />
                        Include
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewEntries.map((entry, i) => {
                    const segments = flattenSegments(entry);
                    const match = entry.employeeMatch || {};
                    const resolvedId = resolvedUserId(entry);
                    const resolvedName =
                      (resolvedId && employees.find((e) => e.id === resolvedId) && employeeFullName(employees.find((e) => e.id === resolvedId))) ||
                      match.employeeName ||
                      entry.rawName;

                    const segmentLabels = [
                      segments.regular && "Reg",
                      segments.driverAm && "AM",
                      segments.driverPm && "PM",
                    ].filter(Boolean);
                    const hasFlags =
                      entry.warnings?.length > 0 ||
                      [segments.regular, segments.driverAm, segments.driverPm].some((s) => s?.capped);
                    const hasExpandableDetail = segmentLabels.length > 0 || entry.warnings?.length > 0;
                    const isExpanded = expandedRow === i;

                    return (
                      <Fragment key={i}>
                        <TableRow
                          className={
                            entry.skip
                              ? "bg-muted/20 text-muted-foreground"
                              : STATUS_ROW_COLOR[entry.status] || ""
                          }
                        >
                          <TableCell className="align-top">
                            {hasExpandableDetail && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setExpandedRow(isExpanded ? null : i)}
                                aria-label={isExpanded ? "Collapse segment detail" : "Expand segment detail"}
                              >
                                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="align-top break-words space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">{resolvedName}</span>
                              {match.status === "matched" ? (
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">Matched</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                match.status && (
                                  <Badge variant="outline" className={MATCH_BADGE[match.status] || ""}>
                                    {match.status === "matched-fuzzy" ? `Fuzzy ${Math.round((match.similarity || 0) * 100)}%` : "Unresolved"}
                                  </Badge>
                                )
                              )}
                            </div>
                            {(match.status === "matched-fuzzy" || match.status === "unresolved") && (
                              <div className="space-y-1">
                                {(match.candidates || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {[...match.candidates]
                                      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
                                      .slice(0, 2)
                                      .map((c) => (
                                        <button
                                          key={c.userId}
                                          type="button"
                                          onClick={() => handleEmployeeOverride(i, c.userId)}
                                          className={`text-[10px] px-1.5 py-0.5 rounded-full border hover:bg-muted ${
                                            resolvedId === c.userId ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" : "border-muted-foreground/30"
                                          }`}
                                        >
                                          {c.employeeName} ({Math.round(c.similarity * 100)}%)
                                        </button>
                                      ))}
                                  </div>
                                )}
                                <MultiSelect
                                  options={employeeOptions}
                                  selected={resolvedId ? [resolvedId] : []}
                                  onChange={(val) => handleEmployeeOverride(i, val === "all" ? null : val)}
                                  allLabel="Select an employee…"
                                  width={0}
                                  className="w-full h-7 text-xs"
                                  searchable
                                  sortable
                                  singleSelect
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-top whitespace-nowrap">{fmtRowDate(entry.date)}</TableCell>
                          <TableCell className="align-top text-xs space-y-1">
                            {(entry.records || []).length === 0 && <span className="text-muted-foreground">—</span>}
                            {(entry.records || []).map((rec, ri) => (
                              <div key={ri} className="whitespace-nowrap">
                                {entry.records.length > 1 && (
                                  <span className="font-medium text-muted-foreground">
                                    {PUNCH_TYPE_LABEL[rec.punchType] || rec.punchType}:{" "}
                                  </span>
                                )}
                                {safeTime(rec.timeIn, companyTimezone)} → {safeTime(rec.timeOut, companyTimezone)}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="align-top">
                            {segmentLabels.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                                {segmentLabels.join(" + ")}
                                {hasFlags && <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className={`cursor-default ${STATUS_BADGE[entry.status] || ""}`}>
                                    {STATUS_LABEL[entry.status] || entry.status}
                                  </Badge>
                                </TooltipTrigger>
                                {entry.reason && <TooltipContent className="max-w-[220px] text-xs">{entry.reason}</TooltipContent>}
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={!entry.skip}
                                disabled={entry.status === "error"}
                                onCheckedChange={(v) => handleSkipToggle(i, !v)}
                                className="h-4 w-4"
                              />
                            </div>
                          </TableCell>
                        </TableRow>

                        <AnimatePresence initial={false}>
                          {isExpanded && hasExpandableDetail && (
                            <motion.tr
                              key={`${i}-expand`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="bg-muted/20"
                            >
                              <TableCell colSpan={7} className="p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  {segments.regular && <SegmentCell label="Reg" segment={segments.regular} />}
                                  {segments.driverAm && <SegmentCell label="AM" segment={segments.driverAm} />}
                                  {segments.driverPm && <SegmentCell label="PM" segment={segments.driverPm} />}
                                </div>
                                {entry.warnings?.length > 0 && (
                                  <div className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                                    {entry.warnings.map((w, wi) => (
                                      <div key={wi} className="flex items-start gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                        <span>{w}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "confirming" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing…
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-orange-500 h-2 rounded-full animate-pulse w-full" />
            </div>
          </div>
        )}

        {step === "summary" && confirmResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {confirmResult.created.length} imported
              </span>
              {confirmResult.conflicted.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  {confirmResult.conflicted.length} deferred (conflict)
                </span>
              )}
              {confirmResult.failed.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {confirmResult.failed.length} failed
                </span>
              )}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {confirmResult.approvalsSynced} approval record{confirmResult.approvalsSynced === 1 ? "" : "s"} synced
              </span>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                These records must be approved using <span className="font-semibold">Approve Raw</span> — Approve
                Schedule will always credit the full scheduled shift instead of the imported hours. A day with both
                AM and PM hours briefly shows as two pending line items on the approval page — that's expected, not
                a duplicate.
              </AlertDescription>
            </Alert>

            {(confirmResult.failed.length > 0 || confirmResult.conflicted.length > 0) && (
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead className="w-40">Employee</TableHead>
                      <TableHead className="w-24">Date</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-auto">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ...confirmResult.conflicted.map((r) => ({ ...r, kind: "conflict" })),
                      ...confirmResult.failed.map((r) => ({ ...r, kind: "failed" })),
                    ]
                      .sort((a, b) => a.row - b.row)
                      .map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="align-top">{r.row}</TableCell>
                          <TableCell className="align-top break-words">{r.employeeId || "—"}</TableCell>
                          <TableCell className="align-top">{r.date || "—"}</TableCell>
                          <TableCell className="align-top">
                            {r.kind === "conflict" ? (
                              <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />Conflict
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                <XCircle className="h-3.5 w-3.5 shrink-0" />Failed
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="align-top break-words whitespace-normal">{r.reason}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "setup" && (
            <>
              <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
              <Button
                onClick={handleUpload}
                disabled={!file}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Upload &amp; Preview
              </Button>
            </>
          )}
          {step === "needsPeriod" && (
            <>
              <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />Back
              </Button>
              <Button
                onClick={handleCreatePeriodAndContinue}
                disabled={!createPeriodForm.paymentDate || creatingPeriod}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {creatingPeriod ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Creating…</>
                ) : (
                  "Create Period & Continue"
                )}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={includedCount === 0 || hasBlockingUnresolved}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Confirm &amp; Import ({includedCount})
              </Button>
            </>
          )}
          {step === "summary" && (
            <>
              <Button variant="outline" onClick={handleGoToReview}>
                <ExternalLink className="h-4 w-4 mr-1.5" />Go to Cutoff Period Review
              </Button>
              <Button onClick={() => handleDialogOpenChange(false)}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
