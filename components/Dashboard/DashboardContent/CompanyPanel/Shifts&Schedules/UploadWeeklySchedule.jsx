/* components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/UploadWeeklySchedule.jsx */
"use client";

// BB-103 — Upload Schedule (rework of BB-081 Upload Weekly Schedule). The server does all the
// work — template, parsing, matching, overlap/spill checks and which actions each item allows
// (docs/server-request-BB-103-upload-schedule.md + the server's reply). This dialog only
// collects the choices, shows the preview as returned, and sends one decision per item.

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Download, Loader2, FileSpreadsheet, XCircle, ArrowLeft, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MultiSelect from "@/components/common/MultiSelect";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_RANGE_DAYS = 14;

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
const fmtYmd = (ymd, withYear = false) => {
  const dt = parseDateOnly(ymd);
  return dt ? dt.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }) : "—";
};
// Preview times are "HH:MM" strings.
const fmtHHMM = (hhmm) => {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm || "—";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
// Shift records store times as UTC-anchored timestamps — same formatting as Schedules.jsx.
const fmtShiftTime = (t) => {
  if (!t) return "—";
  try {
    return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC" });
  } catch {
    return "";
  }
};

// "all" sentinel selection, same model MultiSelect's own "all" row uses.
const toggleSelection = (prev, val) => {
  if (val === "all") return ["all"];
  let list = prev.filter((x) => x !== "all");
  list = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
  return list.length ? list : ["all"];
};

const NOT_CLEAN_GROUPS = [
  { status: "conflict_existing", title: "Overlaps an existing assignment" },
  { status: "conflict_file",     title: "Overlaps another entry in this file" },
  { status: "error",             title: "Can't be processed" },
];

const ShiftCell = ({ shift }) =>
  shift ? (
    <span>
      {fmtHHMM(shift.startTime)}–{fmtHHMM(shift.endTime)}
      {shift.crossesMidnight && (
        <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold align-top">
          +1
        </span>
      )}
    </span>
  ) : "—";

export default function UploadWeeklySchedule({ open, onOpenChange, onImportComplete, shifts = [], employees = [], departments = [] }) {
  const { token, role } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const isSupervisor = (role || "").toLowerCase() === "supervisor";
  const fileInputRef = useRef(null);
  const tableScrollRef = useRef(null);
  const [atTableBottom, setAtTableBottom] = useState(true);

  const [step, setStep] = useState("setup"); // "setup" | "uploading" | "preview" | "confirming"
  const [mode, setMode] = useState("shifts"); // "shifts" | "time_blocks"
  const [overnight, setOvernight] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetMode, setTargetMode] = useState("all"); // "all" | "department" | "specific"
  const [departmentId, setDepartmentId] = useState("");
  const [userIds, setUserIds] = useState(["all"]);
  const [shiftIds, setShiftIds] = useState(["all"]);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [decisions, setDecisions] = useState({}); // key → "create" | "skip" | "replace"
  const [shiftNames, setShiftNames] = useState({}); // key → edited shift name (time_blocks only)

  const isReviewStep = step === "preview" || step === "confirming";

  // Inactive employees in `userIds` are a 403 server-side — only active ones are offered.
  const activeEmployees = useMemo(() => employees.filter((e) => !e.status || e.status === "active"), [employees]);
  const employeeOptions = useMemo(
    () => activeEmployees.map((e) => ({
      value: e.id,
      label: `${e.profile?.firstName ?? ""} ${e.profile?.lastName ?? ""}`.trim() || e.email,
    })),
    [activeEmployees]
  );
  const shiftOptions = useMemo(
    () => shifts.map((s) => ({ value: s.id, label: `${s.shiftName} (${fmtShiftTime(s.startTime)} - ${fmtShiftTime(s.endTime)})` })),
    [shifts]
  );

  // The same list goes to /template and /preview — the server rebuilds the headers from it.
  const resolvedShiftIds = shiftIds.includes("all") ? shifts.map((s) => s.id) : shiftIds;

  const rangeDays = daysInclusive(startDate, endDate);
  const rangeError =
    !startDate || !endDate ? null
    : rangeDays < 1 ? "End date must be on or after the start date."
    : rangeDays > MAX_RANGE_DAYS ? `The range can be at most ${MAX_RANGE_DAYS} days.`
    : null;
  const setupReady =
    startDate && endDate && !rangeError &&
    (mode === "time_blocks" || resolvedShiftIds.length > 0) &&
    (targetMode !== "department" || departmentId) &&
    (targetMode !== "specific" || !userIds.includes("all"));

  const resetState = () => {
    setStep("setup");
    setMode("shifts");
    setOvernight(false);
    setStartDate("");
    setEndDate("");
    setTargetMode("all");
    setDepartmentId("");
    setUserIds(["all"]);
    setShiftIds(["all"]);
    setFile(null);
    setDragActive(false);
    setSetupError(null);
    setPreview(null);
    setDecisions({});
    setShiftNames({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDialogOpenChange = (nextOpen) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    // Keep the end date inside the 14-day window; default it to a week.
    if (!endDate || endDate < value || daysInclusive(value, endDate) > MAX_RANGE_DAYS) setEndDate(value ? addDays(value, 6) : "");
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

  const scopeParams = (params) => {
    if (targetMode === "department" && departmentId) params.set("departmentId", departmentId);
    if (targetMode === "specific" && !userIds.includes("all")) params.set("userIds", userIds.join(","));
  };

  const handleDownloadTemplate = async () => {
    if (!setupReady) return;
    setDownloadingTemplate(true);
    try {
      const params = new URLSearchParams({ mode, startDate, endDate });
      if (mode === "shifts") params.set("shiftIds", resolvedShiftIds.join(","));
      scopeParams(params);
      const res = await fetch(`${API_URL}/api/schedule-import/template?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message || "Could not download template.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `schedule_${mode}_${startDate}_to_${endDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !setupReady) return;
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
    formData.append("mode", mode);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);
    if (mode === "time_blocks") formData.append("overnight", overnight ? "true" : "false");
    if (mode === "shifts") formData.append("shiftIds", resolvedShiftIds.join(","));

    try {
      const res = await fetch(`${API_URL}/api/schedule-import/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => null);

      if (res.ok) {
        const data = json?.data || {};
        // Default: clean → create, everything else → skip (the admin opts into Replace).
        const initial = {};
        (data.items || []).forEach((it) => {
          initial[it.key] = it.allowedActions?.includes("create") ? "create" : "skip";
        });
        setPreview(data);
        setDecisions(initial);
        setShiftNames({});
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

  const handleBack = () => {
    setStep("setup");
    setFile(null);
    setPreview(null);
    setDecisions({});
    setShiftNames({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drives the floating "scroll down" button — hidden once the review list is
  // scrolled to its end (or never overflowed in the first place).
  const checkTableScrollPosition = () => {
    const el = tableScrollRef.current;
    if (!el) return;
    setAtTableBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  };

  const scrollTableDown = () => {
    tableScrollRef.current?.scrollBy({ top: Math.round(tableScrollRef.current.clientHeight * 0.8), behavior: "smooth" });
  };

  const items = preview?.items || [];
  useEffect(() => {
    checkTableScrollPosition();
  }, [items]);

  const cleanItems = useMemo(() => items.filter((it) => it.status === "ready"), [items]);
  const notCleanCount = items.length - cleanItems.length;
  const createCount  = useMemo(() => Object.values(decisions).filter((a) => a === "create").length, [decisions]);
  const replaceCount = useMemo(() => Object.values(decisions).filter((a) => a === "replace").length, [decisions]);
  const submitCount = createCount + replaceCount;
  const rangeLabel = preview?.range
    ? `${fmtYmd(preview.range.startDate)} – ${fmtYmd(preview.range.endDate, true)}`
    : `${fmtYmd(startDate)} – ${fmtYmd(endDate, true)}`;

  const handleConfirm = async () => {
    setStep("confirming");
    try {
      const body = {
        mode: preview?.mode || mode,
        decisions: Object.entries(decisions).map(([key, action]) => ({ key, action })),
        // Edited names only matter for time_blocks — the server re-matches by name and times.
        items: items.map((it) =>
          shiftNames[it.key] != null && it.shift ? { ...it, shift: { ...it.shift, shiftName: shiftNames[it.key] } } : it
        ),
      };
      const res = await fetch(`${API_URL}/api/schedule-import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);

      if (res.ok || res.status === 207) {
        const created  = json?.data?.created  || [];
        const replaced = json?.data?.replaced || [];
        const skipped  = json?.data?.skipped  || [];
        const failed   = json?.data?.failed   || [];
        const parts = [`${created.length} created`];
        if (replaced.length) parts.push(`${replaced.length} replaced`);
        if (skipped.length)  parts.push(`${skipped.length} skipped`);
        if (failed.length === 0) {
          toast.success(`${parts.join(", ")} for ${rangeLabel}.`);
        } else {
          toast.warning(`${parts.join(", ")}, ${failed.length} failed. ${failed[0]?.reason || ""}`.trim());
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

  const employeeLabel = (it) => it.employee?.name || it.employee?.employeeId || "—";

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={`${isReviewStep ? "sm:max-w-4xl" : "sm:max-w-lg"} border-2 dark:border-white/10`}>
        <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500 text-white shadow">
              <Upload className="h-4 w-4" />
            </div>
            {isReviewStep ? "Review Schedule Upload" : "Upload Schedule"}
          </DialogTitle>
          <DialogDescription>
            {isReviewStep
              ? `Here's what the file proposes for ${rangeLabel}. Clean entries will be created; decide what to do with the rest.`
              : "Download a pre-filled template for your employees and dates, mark their shifts, then upload it back here."}
          </DialogDescription>
        </DialogHeader>

        {step === "setup" && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {setupError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{setupError}</AlertDescription>
              </Alert>
            )}

            {/* Mode */}
            <div className="space-y-2">
              <Label>How will you mark the schedule? <span className="text-orange-500">*</span></Label>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                  <input
                    type="radio" name="mode"
                    checked={mode === "shifts"}
                    onChange={() => setMode("shifts")}
                    className="mt-1 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm">
                    Existing shifts
                    <span className="block text-xs text-muted-foreground">One column per shift you pick. Mark &quot;1&quot; under each shift the employee works that day.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                  <input
                    type="radio" name="mode"
                    checked={mode === "time_blocks"}
                    onChange={() => setMode("time_blocks")}
                    className="mt-1 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm">
                    Time blocks (30-min)
                    <span className="block text-xs text-muted-foreground">Mark &quot;1&quot; in each half-hour block from 1:00 AM to midnight the employee works.</span>
                  </span>
                </label>
              </div>
            </div>

            {mode === "shifts" ? (
              <div className="space-y-1.5">
                <Label>Shifts in this upload <span className="text-orange-500">*</span></Label>
                <MultiSelect
                  options={shiftOptions}
                  selected={shiftIds}
                  onChange={(v) => setShiftIds((prev) => toggleSelection(prev, v))}
                  allLabel="All shifts"
                  width={0}
                  className="w-full"
                  searchable
                  sortable
                  fullWidthContent
                />
                <p className="text-xs text-muted-foreground">Pick only the shifts this schedule uses — each one becomes a column.</p>
              </div>
            ) : (
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
                    ? "A run reaching midnight joins the run starting at 1:00 AM on the same row."
                    : "Time blocks run from 1:00 AM to midnight each day."}
                </p>
              </div>
            )}

            {/* Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Start date <span className="text-orange-500">*</span></Label>
                <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label>End date <span className="text-orange-500">*</span></Label>
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
            <p className={`text-xs -mt-2 ${rangeError ? "text-red-600" : "text-muted-foreground"}`}>
              {rangeError || (rangeDays ? `${rangeDays} day${rangeDays === 1 ? "" : "s"} · up to ${MAX_RANGE_DAYS}.` : `Up to ${MAX_RANGE_DAYS} days.`)}
            </p>

            {/* Target employees */}
            <div className="space-y-1.5">
              <Label>Target employees <span className="text-orange-500">*</span></Label>
              <Select value={targetMode} onValueChange={setTargetMode}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isSupervisor ? "Everyone in my department" : "All active employees"}</SelectItem>
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
              <p className="text-xs text-muted-foreground">The template is pre-filled with one row per employee per date.</p>
            </div>

            <div className="space-y-1">
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate || !setupReady}
              >
                {downloadingTemplate ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Downloading…</>
                ) : (
                  <><Download className="h-4 w-4 mr-1.5" />Download CSV Template</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Leave a row blank for a day off. Don&apos;t rename or reorder the columns.
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
                  <p className="text-xs text-muted-foreground">.csv files only, up to 5MB · same mode, shifts and dates as the template</p>
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
          <div className="space-y-3">
            {items.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nothing to import — every row in this file is blank{preview?.summary?.rows ? ` (${preview.summary.rows} rows)` : ""}.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{cleanItems.length}</span> clean ·{" "}
                <span className="font-medium text-foreground">{notCleanCount}</span> need{notCleanCount === 1 ? "s" : ""} attention
                {preview?.summary?.blankRows ? ` · ${preview.summary.blankRows} blank row${preview.summary.blankRows === 1 ? "" : "s"} skipped (days off)` : ""}
              </p>
            )}

            {replaceCount > 0 && (
              <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  Replace removes the existing assignment{replaceCount === 1 ? "" : "s"} permanently. The employee gets a &quot;Shift Changed&quot; notification.
                </AlertDescription>
              </Alert>
            )}

            <div className="relative">
              <div
                ref={tableScrollRef}
                onScroll={checkTableScrollPosition}
                className="max-h-[50vh] overflow-y-auto space-y-4 pr-1"
              >
                {/* Clean */}
                {cleanItems.length > 0 && (
                  <div className="rounded-md border">
                    <div className="px-3 py-2 border-b bg-green-50 dark:bg-green-900/20 text-sm font-semibold text-green-800 dark:text-green-400">
                      Clean — will be created ({cleanItems.length})
                    </div>
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-40">Employee</TableHead>
                          <TableHead className="w-24">Date</TableHead>
                          <TableHead className="w-36">Time</TableHead>
                          <TableHead className="w-auto">Shift</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cleanItems.map((it) => (
                          <TableRow key={it.key}>
                            <TableCell className="align-top break-words">{employeeLabel(it)}</TableCell>
                            <TableCell className="align-top">{fmtYmd(it.date)}</TableCell>
                            <TableCell className="align-top"><ShiftCell shift={it.shift} /></TableCell>
                            <TableCell className="align-top">
                              {preview?.mode === "time_blocks" ? (
                                <Input
                                  value={shiftNames[it.key] ?? it.shift?.shiftName ?? ""}
                                  onChange={(e) => setShiftNames((prev) => ({ ...prev, [it.key]: e.target.value }))}
                                  className="h-8 text-sm"
                                />
                              ) : (
                                it.shift?.shiftName || "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Not clean, grouped by reason */}
                {NOT_CLEAN_GROUPS.map(({ status, title }) => {
                  const group = items.filter((it) => it.status === status);
                  if (group.length === 0) return null;
                  return (
                    <div key={status} className="rounded-md border">
                      <div className={`px-3 py-2 border-b text-sm font-semibold ${
                        status === "error"
                          ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                          : "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                      }`}>
                        {title} ({group.length})
                      </div>
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-40">Employee</TableHead>
                            <TableHead className="w-24">Date</TableHead>
                            <TableHead className="w-44">Uploaded</TableHead>
                            <TableHead className="w-auto">{status === "error" ? "Reason" : "Clashes with"}</TableHead>
                            {status === "conflict_existing" && <TableHead className="w-44 text-right">Action</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.map((it) => {
                            const canReplace = it.allowedActions?.includes("replace");
                            const action = decisions[it.key] || "skip";
                            return (
                              <TableRow key={it.key} className={status !== "conflict_existing" || action === "skip" ? "opacity-70" : ""}>
                                <TableCell className="align-top break-words">
                                  {employeeLabel(it)}
                                  {it.row != null && <span className="block text-[10px] text-muted-foreground">Row {it.row}</span>}
                                </TableCell>
                                <TableCell className="align-top">{fmtYmd(it.date)}</TableCell>
                                <TableCell className="align-top text-sm">
                                  {it.shift ? (
                                    <>
                                      <span className="block font-medium">{it.shift.shiftName}</span>
                                      <ShiftCell shift={it.shift} />
                                    </>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="align-top text-sm space-y-1">
                                  {status === "error" ? (
                                    <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 whitespace-normal">{it.reason || "Error"}</Badge>
                                  ) : (it.conflicts || []).length === 0 ? (
                                    <span className="text-muted-foreground">{it.reason || "—"}</span>
                                  ) : (
                                    (it.conflicts || []).map((c, ci) => (
                                      <div key={c.userShiftId || c.key || ci}>
                                        <span className="font-medium">{c.shiftName}</span>{" "}
                                        <span className="text-muted-foreground">
                                          {c.date && c.date !== it.date ? `${fmtYmd(c.date)} · ` : ""}
                                          <ShiftCell shift={c} />
                                        </span>
                                        {status === "conflict_existing" && c.replaceable === false && c.notReplaceableReason && (
                                          <span className="block text-[11px] text-red-600">{c.notReplaceableReason}</span>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </TableCell>
                                {status === "conflict_existing" && (
                                  <TableCell className="align-top text-right">
                                    <div className="inline-flex rounded-md border overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() => setDecisions((prev) => ({ ...prev, [it.key]: "skip" }))}
                                        className={`px-2.5 py-1 text-xs font-semibold ${action === "skip" ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                      >
                                        Reject
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!canReplace}
                                        title={canReplace ? "Remove the existing assignment and create this one" : "This assignment can't be replaced"}
                                        onClick={() => setDecisions((prev) => ({ ...prev, [it.key]: "replace" }))}
                                        className={`px-2.5 py-1 text-xs font-semibold border-l disabled:opacity-40 disabled:cursor-not-allowed ${action === "replace" ? "bg-orange-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                      >
                                        Replace
                                      </button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {status !== "conflict_existing" && (
                        <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">
                          These won&apos;t be imported. Fix them in the file and upload it again.
                        </p>
                      )}
                    </div>
                  );
                })}
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
              <Button onClick={handleUpload} disabled={!file || !setupReady} className="bg-orange-500 hover:bg-orange-600 text-white">
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
              <Button onClick={handleConfirm} disabled={submitCount === 0} className="bg-orange-500 hover:bg-orange-600 text-white">
                Confirm ({createCount} create{replaceCount ? `, ${replaceCount} replace` : ""})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
