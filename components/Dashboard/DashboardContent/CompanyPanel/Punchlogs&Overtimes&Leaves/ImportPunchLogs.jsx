/* components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/ImportPunchLogs.jsx */
"use client";

// BB-108 — the template comes pre-filled (one row per employee per date, like Upload
// Schedule), so admins only type clock-in / clock-out. Blank rows are days off and the
// server skips them. Contract: docs/server-request-BB-108-import-punch-logs.md.

import { useMemo, useRef, useState } from "react";
import { Upload, Download, Loader2, Lock, FileSpreadsheet, XCircle, CheckCircle2, Info } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import useImportTeam from "@/lib/hooks/useImportTeam";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MultiSelect from "@/components/common/MultiSelect";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_RANGE_DAYS = 31;
// Server limits (BB-108): template rows (employees × days), file rows, rows with punches.
const MAX_TEMPLATE_ROWS = 2000;
const MAX_PUNCH_ROWS = 500;

// Same date helpers as UploadWeeklySchedule.jsx — local YYYY-MM-DD, no timezone shifts.
const parseDateOnly = (str) => {
  const [y, m, d] = (str || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const toYmd = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const addDays = (ymd, n) => {
  const dt = parseDateOnly(ymd);
  if (!dt) return "";
  dt.setDate(dt.getDate() + n);
  return toYmd(dt);
};
const daysInclusive = (startYmd, endYmd) => {
  const s = parseDateOnly(startYmd);
  const e = parseDateOnly(endYmd);
  return s && e ? Math.round((e - s) / 86400000) + 1 : 0;
};

// "all" sentinel selection, same model MultiSelect's own "all" row uses.
const toggleSelection = (prev, val) => {
  if (val === "all") return ["all"];
  let list = prev.filter((x) => x !== "all");
  list = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
  return list.length ? list : ["all"];
};

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

export default function ImportPunchLogs({
  open,
  onOpenChange,
  isDayCare,
  currentUserRole,
  onImportComplete,
  employees = [],
  departments = [],
}) {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const fileInputRef = useRef(null);

  const [step, setStep] = useState("idle"); // "idle" | "uploading" | "results"
  const [file, setFile] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [templateError, setTemplateError] = useState(null);
  const [result, setResult] = useState(null); // { message, created: [], failed: [], skipped }
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetMode, setTargetMode] = useState("all"); // "all" | "department" | "specific"
  const [departmentId, setDepartmentId] = useState("");
  const [userIds, setUserIds] = useState(["all"]);

  const isSupervisor = (currentUserRole || "").toLowerCase() === "supervisor";

  // Active people in the uploader's team (supervisors: own department + direct reports);
  // anyone else in `userIds` is a 403.
  const activeEmployees = useImportTeam(open, token, employees);
  const employeeOptions = useMemo(
    () =>
      activeEmployees
        .map((e) => ({
          value: e.id,
          label: `${e.profile?.firstName ?? ""} ${e.profile?.lastName ?? ""}`.trim() || e.email,
        })),
    [activeEmployees]
  );

  const rangeDays = daysInclusive(startDate, endDate);
  const rangeError =
    !startDate || !endDate ? null
    : rangeDays < 1 ? "End date must be on or after the start date."
    : rangeDays > MAX_RANGE_DAYS ? `The range can be at most ${MAX_RANGE_DAYS} days.`
    : null;

  // Template rows = employees × days, shown live. The team list is the same scope the
  // server uses, so "everyone" counts for supervisors too; the server still checks.
  const employeeCount =
    targetMode === "specific" ? (userIds.includes("all") ? 0 : userIds.length)
    : targetMode === "department" ? (departmentId ? activeEmployees.filter((e) => (e.departmentId ?? e.department?.id) === departmentId).length : 0)
    : activeEmployees.length;
  const templateRows = employeeCount != null && rangeDays > 0 && !rangeError ? employeeCount * rangeDays : null;
  const tooManyRows = templateRows != null && templateRows > MAX_TEMPLATE_ROWS;

  const templateReady =
    startDate && endDate && !rangeError && !tooManyRows &&
    (targetMode !== "department" || departmentId) &&
    (targetMode !== "specific" || !userIds.includes("all"));

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
    setTemplateError(null);
    setResult(null);
    setStartDate("");
    setEndDate("");
    setTargetMode("all");
    setDepartmentId("");
    setUserIds(["all"]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    // Keep the end date inside the window; default it to two weeks.
    if (!endDate || endDate < value || daysInclusive(value, endDate) > MAX_RANGE_DAYS) setEndDate(value ? addDays(value, 13) : "");
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

  // Pre-filled: one row per chosen employee per date. Without a range the server
  // still returns the old blank template, so this always sends one.
  const handleDownloadTemplate = async () => {
    if (!templateReady) return;
    setDownloadingTemplate(true);
    setTemplateError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (targetMode === "department" && departmentId) params.set("departmentId", departmentId);
      if (targetMode === "specific" && !userIds.includes("all")) params.set("userIds", userIds.join(","));
      const res = await fetch(`${API_URL}/api/punch-log-import/template?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Only a 200 is the CSV; anything else is JSON { message }, shown under the button
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setTemplateError(json?.message || "Could not download the template.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `punch_logs_${startDate}_to_${endDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setTemplateError("Could not download the template.");
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
          skipped: json?.data?.skipped || 0,
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
      <DialogContent className={`${step === "results" ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[90vh] overflow-y-auto border-2 dark:border-white/10`}>
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

            {/* 1. Template */}
            <div className="space-y-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">1. Download a template for your employees and dates</p>
                <p className="text-xs text-muted-foreground">
                  Pick the dates (up to {MAX_RANGE_DAYS} days) and employees. We&apos;ll fill in names, emails and dates. You only add clock-in and clock-out times.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    max={startDate ? addDays(startDate, MAX_RANGE_DAYS - 1) : undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <p className={`text-xs -mt-1 ${rangeError ? "text-red-600" : "text-muted-foreground"}`}>
                {rangeError || (rangeDays ? `${rangeDays} day${rangeDays === 1 ? "" : "s"} · up to ${MAX_RANGE_DAYS}.` : `Up to ${MAX_RANGE_DAYS} days.`)}
              </p>

              <div className="space-y-1.5">
                <Label>Employees</Label>
                <Select value={targetMode} onValueChange={setTargetMode}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isSupervisor ? "Everyone on my team" : "All active employees"}</SelectItem>
                    {!isSupervisor && <SelectItem value="department">One department</SelectItem>}
                    <SelectItem value="specific">Specific employees</SelectItem>
                  </SelectContent>
                </Select>
                {targetMode === "department" && (
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Choose a department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {targetMode === "specific" && (
                  <MultiSelect
                    options={employeeOptions}
                    selected={userIds}
                    onChange={(v) => setUserIds((prev) => toggleSelection(prev, v))}
                    allLabel="Choose employees"
                    width={0}
                    className="w-full"
                    searchable
                    sortable
                  />
                )}
              </div>

              <div className="space-y-1">
                {templateRows != null && (
                  <p className={`text-xs ${tooManyRows ? "text-red-600" : "text-muted-foreground"}`}>
                    {tooManyRows
                      ? `Too many rows (${templateRows.toLocaleString()}). Pick fewer employees or days.`
                      : `${templateRows.toLocaleString()} rows (${employeeCount} employee${employeeCount === 1 ? "" : "s"} × ${rangeDays} day${rangeDays === 1 ? "" : "s"}).`}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate || !templateReady}
                >
                  {downloadingTemplate ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Downloading…</>
                  ) : (
                    <><Download className="h-4 w-4 mr-1.5" />Download CSV Template</>
                  )}
                </Button>
                {templateError && <p className="text-xs text-red-600 text-center">{templateError}</p>}
                <p className="text-xs text-muted-foreground text-center">
                  Leave a row&apos;s times empty for a day off; it&apos;s skipped. For two punches on one day, copy the row and fill each one.
                </p>
              </div>
            </div>

            {/* 2. Upload */}
            <p className="text-sm font-medium border-t pt-4">2. Upload the filled-in file</p>
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

            <div className="space-y-1 text-xs text-muted-foreground">
              {isSupervisor && <p>Supervisors can import for their team: their own department and their direct reports.</p>}
              <p>
                The first row of the template is a guide to the allowed values. It starts with # and is never imported. You
                can delete it or leave it in.
              </p>
              <p>Times: 08:00 or 8:00 AM. A clock-out earlier than the clock-in counts as the next day.</p>
              <p>
                punchType:{" "}
                {isDayCare
                  ? "REGULAR, DRIVER_AIDE, DRIVER_AIDE_AM, DRIVER_AIDE_PM or TRAINING."
                  : "REGULAR or TRAINING (Driver/Aide types aren't available for this company)."}{" "}
                Leave it blank for REGULAR.
              </p>
              <p>
                Dates accepted: YYYY-MM-DD, M/D/YY, M/D/YYYY, MM/DD/YY, MM/DD/YYYY — check that every row uses the
                same format, since spreadsheet autofill can silently change it per cell.
              </p>
              <p>
                Up to {MAX_PUNCH_ROWS} rows with punches and {MAX_TEMPLATE_ROWS.toLocaleString()} rows in total per file, 5MB max. A filled row
                needs both a clock-in and a clock-out — open/in-progress punches aren&apos;t supported.
              </p>
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
              Importing {file?.name}…
            </div>
            <p className="text-xs text-center text-muted-foreground">A full file can take up to 30 seconds. Keep this window open.</p>
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
              {result.skipped > 0 && (
                <span className="text-xs text-muted-foreground">
                  {result.skipped} blank row{result.skipped === 1 ? "" : "s"} skipped
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
                      <TableCell className="align-top break-words">{r.name || r.employeeId || "—"}</TableCell>
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
