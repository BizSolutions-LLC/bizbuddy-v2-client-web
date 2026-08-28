/* components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/ImportPunchLogs.jsx */
"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, Download, Loader2, Lock, FileSpreadsheet, XCircle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const isLockedCutoffReason = (reason = "") => {
  const r = reason.toLowerCase();
  return r.includes("locked") || r.includes("processed");
};

// created rows carry parsed ISO datetimes (already in the company's timezone); failed rows
// carry the raw, possibly-malformed values as typed, so they aren't run through Date parsing.
const formatParsedRange = (clockIn, clockOut) => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "—";
  const dateStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${fmtTime(start)}–${fmtTime(end)}`;
};

const formatRawRange = (date, clockIn, clockOut) => {
  const parts = [date || "—"];
  if (clockIn || clockOut) parts.push(`${clockIn || "?"}–${clockOut || "?"}`);
  return parts.join(" · ");
};

export default function ImportPunchLogs({ open, onOpenChange, isDayCare, currentUserRole, onImportComplete }) {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const fileInputRef = useRef(null);

  const [step, setStep] = useState("idle"); // "idle" | "uploading" | "results"
  const [file, setFile] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [result, setResult] = useState(null); // { message, created: [], failed: [] }

  const isSupervisor = (currentUserRole || "").toLowerCase() === "supervisor";

  const mergedRows = useMemo(() => {
    if (!result) return [];
    return [
      ...result.created.map((r) => ({ ...r, status: "created" })),
      ...result.failed.map((r) => ({ ...r, status: "failed" })),
    ].sort((a, b) => a.row - b.row);
  }, [result]);

  const resetState = () => {
    setStep("idle");
    setFile(null);
    setUploadError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDialogOpenChange = (nextOpen) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  };

  const handleFileSelect = (e) => {
    const picked = e.target.files?.[0] || null;
    setUploadError(null);
    setFile(picked);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await fetch(`${API_URL}/api/punch-log-import/template`, {
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
      link.download = "punch_log_import_template.csv";
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
      setUploadError("Please select a .csv file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("File exceeds the 5MB size limit.");
      return;
    }

    setStep("uploading");
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/punch-log-import/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => null);

      if (res.status === 400 || res.status === 403) {
        setUploadError(json?.message || "Import failed.");
        setStep("idle");
        return;
      }
      if (res.status === 207 || res.ok) {
        setResult({
          message: json?.message || "",
          created: json?.data?.created || [],
          failed: json?.data?.failed || [],
        });
        setStep("results");
        onImportComplete?.();
        return;
      }
      setUploadError(json?.message || `Unexpected error (${res.status}).`);
      setStep("idle");
    } catch {
      setUploadError("Network error — please try again.");
      setStep("idle");
    }
  };

  const handleImportAnother = () => {
    setStep("idle");
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={`${step === "results" ? "sm:max-w-2xl" : "sm:max-w-lg"} border-2 dark:border-white/10`}>
        <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500 text-white shadow">
              <Upload className="h-4 w-4" />
            </div>
            Import Punch Logs
          </DialogTitle>
        </DialogHeader>

        {step === "idle" && (
          <div className="space-y-4">
            {uploadError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
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

            <Button variant="ghost" className="w-full justify-center" onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
              {downloadingTemplate ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Downloading…</>
              ) : (
                <><Download className="h-4 w-4 mr-1.5" />Download Template</>
              )}
            </Button>

            <div className="space-y-1 text-xs text-muted-foreground">
              {isSupervisor && <p>Supervisors can only import punch logs for employees in their own department.</p>}
              {!isDayCare && <p>Driver/Aide punch types are not available for this company; use REGULAR or TRAINING.</p>}
              <p>
                Dates accepted: YYYY-MM-DD, M/D/YY, M/D/YYYY, MM/DD/YY, MM/DD/YYYY — check that every row uses the
                same format, since spreadsheet autofill can silently change it per cell.
              </p>
              <p>Up to 300 rows per file, 5MB max. Each row needs both a clock-in and a clock-out — open/in-progress punches aren't supported.</p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="space-y-1">
                <p>Imported punches are auto-approved immediately — there's no separate approval step.</p>
                <p>
                  No automatic lunch/break deduction is applied to imported punches, unlike a live clock-in with no
                  logged break — net hours can come out higher than an equivalent live-punched day.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "uploading" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading and validating {file?.name}…
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-orange-500 h-2 rounded-full animate-pulse w-full" />
            </div>
          </div>
        )}

        {step === "results" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {result.created.length} imported
              </span>
              {result.failed.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {result.failed.length} failed
                </span>
              )}
            </div>

            <ScrollArea className="max-h-80 rounded-md border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead className="w-28">Employee</TableHead>
                    <TableHead className="w-44">Date &amp; Time</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-auto">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mergedRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="align-top">{r.row}</TableCell>
                      <TableCell className="align-top break-words">{r.employeeId || "—"}</TableCell>
                      <TableCell className="align-top break-words">
                        {r.status === "created"
                          ? formatParsedRange(r.clockIn, r.clockOut)
                          : formatRawRange(r.date, r.clockIn, r.clockOut)}
                      </TableCell>
                      <TableCell className="align-top">
                        {r.status === "created" ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />Imported
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-left align-top whitespace-normal break-words">
                        {r.status === "failed" && (
                          <>
                            {isLockedCutoffReason(r.reason) && (
                              <Lock className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5 text-muted-foreground" />
                            )}
                            {r.reason}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === "idle" && (
            <>
              <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file}>
                <Upload className="h-4 w-4 mr-1.5" />Upload
              </Button>
            </>
          )}
          {step === "results" && (
            <>
              <Button variant="outline" onClick={handleImportAnother}>Import Another File</Button>
              <Button onClick={() => handleDialogOpenChange(false)}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
