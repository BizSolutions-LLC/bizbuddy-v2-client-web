/* components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/UploadWeeklySchedule.jsx */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Download, Loader2, FileSpreadsheet, XCircle, ArrowLeft, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const parseDateOnly = (str) => {
  const [y, m, d] = (str || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

// Preview rows carry per-row `date` strings — derive the displayed range from the
// actual uploaded data rather than the "week starting" form field, since a user
// could in principle upload a file covering a different week than they templated.
const computeWeekRangeLabel = (rows, fallbackWeekStart) => {
  const dates = rows.map((r) => r.date).filter(Boolean).sort();
  const startStr = dates[0] || fallbackWeekStart;
  const startDate = parseDateOnly(startStr);
  if (!startDate) return "";
  const endDate = dates.length
    ? parseDateOnly(dates[dates.length - 1])
    : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endFmt = endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(startDate)} – ${endFmt}`;
};

export default function UploadWeeklySchedule({ open, onOpenChange, onImportComplete }) {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const fileInputRef = useRef(null);
  const tableScrollRef = useRef(null);
  const [atTableBottom, setAtTableBottom] = useState(true);

  const [step, setStep] = useState("setup"); // "setup" | "uploading" | "preview" | "confirming"
  const [overnight, setOvernight] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [weekRange, setWeekRange] = useState("");

  const isReviewStep = step === "preview" || step === "confirming";

  const resetState = () => {
    setStep("setup");
    setOvernight(false);
    setWeekStart("");
    setFile(null);
    setDragActive(false);
    setSetupError(null);
    setPreviewRows([]);
    setWeekRange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDialogOpenChange = (nextOpen) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  };

  const handleFileChosen = (picked) => {
    setSetupError(null);
    setFile(picked || null);
  };

  const handleFileInputChange = (e) => handleFileChosen(e.target.files?.[0] || null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileChosen(dropped);
  };

  const handleDownloadTemplate = async () => {
    if (!weekStart) return;
    setDownloadingTemplate(true);
    try {
      const params = new URLSearchParams({ weekStart, overnight: overnight ? "true" : "false" });
      const res = await fetch(`${API_URL}/api/schedule-import/template?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("Could not download template.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `weekly_schedule_template_${weekStart}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setSetupError("Only CSV files are accepted.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setSetupError("File is too large. Maximum size is 5MB.");
      return;
    }

    setStep("uploading");
    setSetupError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("overnight", overnight ? "true" : "false");

    try {
      const res = await fetch(`${API_URL}/api/schedule-import/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => null);

      if (res.status === 400) {
        setSetupError(json?.message || "This file doesn't contain any schedule data.");
        setStep("setup");
        return;
      }
      if (res.ok) {
        const rows = (json?.data?.rows || []).map((r) => ({ ...r, skip: false }));
        setPreviewRows(rows);
        setWeekRange(computeWeekRangeLabel(rows, weekStart));
        setStep("preview");
        return;
      }
      setSetupError(json?.message || `Unexpected error (${res.status}).`);
      setStep("setup");
    } catch {
      setSetupError("Something went wrong while reading your file. Please try again.");
      setStep("setup");
    }
  };

  const handleShiftNameChange = (index, value) => {
    setPreviewRows((prev) => prev.map((r, i) => (i === index ? { ...r, shiftName: value } : r)));
  };

  const handleSkipToggle = (index, skip) => {
    setPreviewRows((prev) => prev.map((r, i) => (i === index ? { ...r, skip } : r)));
  };

  const handleBack = () => {
    setStep("setup");
    setFile(null);
    setPreviewRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drives the floating "scroll down" button — hidden once the review table is
  // scrolled to its end (or never overflowed in the first place).
  const checkTableScrollPosition = () => {
    const el = tableScrollRef.current;
    if (!el) return;
    setAtTableBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  };

  const scrollTableDown = () => {
    tableScrollRef.current?.scrollBy({ top: Math.round(tableScrollRef.current.clientHeight * 0.8), behavior: "smooth" });
  };

  useEffect(() => {
    checkTableScrollPosition();
  }, [previewRows]);

  const successCount = useMemo(() => previewRows.filter((r) => r.status === "ready").length, [previewRows]);
  const failedCount  = useMemo(() => previewRows.filter((r) => r.status !== "ready").length, [previewRows]);
  // Rows that will actually be submitted for creation: ready rows, plus conflict rows
  // the user hasn't opted to skip. Error rows can never succeed regardless of `skip`.
  const readyCount = useMemo(
    () => previewRows.filter((r) => r.status !== "error" && !r.skip).length,
    [previewRows]
  );

  const handleConfirm = async () => {
    setStep("confirming");
    try {
      const res = await fetch(`${API_URL}/api/schedule-import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rows: previewRows }),
      });
      const json = await res.json().catch(() => null);

      if (res.ok || res.status === 207) {
        const created = json?.data?.created || [];
        const skipped = json?.data?.skipped || [];
        const failed  = json?.data?.failed  || [];
        if (skipped.length === 0 && failed.length === 0) {
          toast.success(`${created.length} shifts created for the week of ${weekRange}.`);
        } else {
          toast.message(`${created.length} shifts created, ${skipped.length + failed.length} skipped.`);
        }
        onImportComplete?.();
        handleDialogOpenChange(false);
        return;
      }
      toast.error(json?.message || `Something went wrong (status ${res.status}).`);
      setStep("preview");
    } catch {
      toast.error("Network error — please try again.");
      setStep("preview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={`${isReviewStep ? "sm:max-w-3xl" : "sm:max-w-lg"} border-2 dark:border-white/10`}>
        <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500 text-white shadow">
              <Upload className="h-4 w-4" />
            </div>
            {isReviewStep ? "Review Schedule Import" : "Upload Weekly Schedule"}
          </DialogTitle>
          <DialogDescription>
            {isReviewStep
              ? `Here's what will be created for the week of ${weekRange}. Review shift names and details before confirming.`
              : "Generate a CSV template for your team's week, fill it in, then upload it back here."}
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

            <div className="space-y-2">
              <Label>Does this schedule include overnight shifts? <span className="text-orange-500">*</span></Label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                  <input
                    type="radio" name="overnight"
                    checked={!overnight}
                    onChange={() => setOvernight(false)}
                    className="text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm">No — Regular hours</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                  <input
                    type="radio" name="overnight"
                    checked={overnight}
                    onChange={() => setOvernight(true)}
                    className="text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm">Yes — Overnight (crosses midnight)</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {overnight
                  ? "Time blocks may extend into the next calendar day for shifts that cross midnight."
                  : "Time blocks will run from 1:00 AM to midnight each day."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Week starting <span className="text-orange-500">*</span></Label>
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="h-9" />
              <p className="text-xs text-muted-foreground">The template will cover 7 days starting from this date.</p>
            </div>

            <div className="space-y-1">
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate || !weekStart}
              >
                {downloadingTemplate ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Downloading…</>
                ) : (
                  <><Download className="h-4 w-4 mr-1.5" />Download CSV Template</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Mark the 30-minute blocks each employee is scheduled for. One row per employee per day.
              </p>
            </div>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Already have your file ready?</span>
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-lg border-2 border-dashed p-6 text-center space-y-2 cursor-pointer transition-colors ${
                dragActive ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-muted-foreground/25"
              }`}
            >
              <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInputChange}
              />
              {file ? (
                <p className="text-sm">
                  <span className="font-medium">{file.name}</span> selected ·{" "}
                  <button
                    type="button"
                    className="text-orange-600 hover:underline"
                    onClick={(e) => { e.stopPropagation(); handleFileChosen(null); }}
                  >
                    Remove
                  </button>
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Drag and drop your completed CSV here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">.csv files only, up to 5MB</p>
                </>
              )}
            </div>
          </div>
        )}

        {step === "uploading" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading and validating {file?.name}…
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-orange-500 h-2 rounded-full animate-pulse w-full" />
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {readyCount === 0 ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  None of the rows in this file could be processed. Review the errors below and re-upload a corrected file.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{successCount}</span> shifts ready to create ·{" "}
                <span className="font-medium text-foreground">{failedCount}</span> row{failedCount === 1 ? "" : "s"} need attention
              </p>
            )}

            <div className="relative">
              <div
                ref={tableScrollRef}
                onScroll={checkTableScrollPosition}
                className="max-h-96 overflow-y-auto rounded-md border"
              >
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Employee</TableHead>
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead className="w-28">Time</TableHead>
                    <TableHead className="w-44">Shift Name</TableHead>
                    <TableHead className="w-auto">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((r, i) => (
                    <TableRow key={i} className={r.skip ? "opacity-50" : ""}>
                      <TableCell className="align-top break-words">{r.employeeName || r.employeeId || "—"}</TableCell>
                      <TableCell className="align-top">{r.date || "—"}</TableCell>
                      <TableCell className="align-top">
                        {r.startTime}–{r.endTime}
                        {r.crossesMidnight && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold align-top">
                            +1
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={r.shiftName || ""}
                          onChange={(e) => handleShiftNameChange(i, e.target.value)}
                          disabled={r.status === "error"}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="align-top space-y-1.5">
                        {r.status === "ready" && (
                          <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400">Ready</Badge>
                        )}
                        {r.status === "conflict" && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400">Conflict — overlaps existing shift</Badge>
                        )}
                        {r.status === "error" && (
                          <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400">{r.reason || "Error"}</Badge>
                        )}
                        {r.status !== "ready" && (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer w-fit">
                            <Checkbox
                              checked={!!r.skip}
                              onCheckedChange={(v) => handleSkipToggle(i, !!v)}
                              className="h-3.5 w-3.5"
                            />
                            Skip this row
                          </label>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              {!atTableBottom && (
                <button
                  type="button"
                  onClick={scrollTableDown}
                  aria-label="Scroll down for more rows"
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center h-7 w-7 rounded-full bg-orange-500 text-white shadow-md hover:bg-orange-600 transition-colors animate-bounce"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {step === "confirming" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating schedules…
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-orange-500 h-2 rounded-full animate-pulse w-full" />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "setup" && (
            <>
              <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file} className="bg-orange-500 hover:bg-orange-600 text-white">
                <Upload className="h-4 w-4 mr-1.5" />Upload &amp; Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />Back
              </Button>
              <Button onClick={handleConfirm} disabled={readyCount === 0} className="bg-orange-500 hover:bg-orange-600 text-white">
                Confirm &amp; Create Schedules ({readyCount})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
