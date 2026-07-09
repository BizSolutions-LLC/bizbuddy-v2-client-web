"use client";
/**
 * ContestDialog — drop-in replacement for the Contest Dialog section in PunchLogs.jsx
 *
 * WHAT CHANGED vs. the original:
 *  1. Log selector shows human-readable date + time range, not a raw DB id.
 *  2. Datetime inputs changed from type="datetime-local" (ISO-sliced, shows UTC)
 *     to type="time" (local time). The full ISO is reconstructed on submit.
 *  3. Before/after comparison strip appears once a log is selected, updating
 *     live as the user edits the time inputs.
 *  4. Delta pill shows net hour impact (+/- from recorded), coloured green/red.
 *  5. Fields grouped into two labelled sections for clarity.
 */

import {
  AlertTriangle,
  AlertCircle,
  User,
  Clock,
  Car,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { safeTime } from "./PunchLogs";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format a JS Date (or timestamp string) to "HH:MM" in the given timezone. */
function toLocalTimeInput(dateStr, tz) {
  if (!dateStr) return "";
  const str = new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    ...(tz ? { timeZone: tz } : {}),
  });
  // toLocaleTimeString with hour12:false may return "24:xx" for midnight — normalise
  return str === "24:00" ? "00:00" : str;
}

/** Format "HH:MM" to "hh:mm AM/PM" for the comparison strip labels. */
function fmt12(timeStr) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Compute net hours between two "HH:MM" strings (same-day assumed). */
function netHours(inTime, outTime) {
  if (!inTime || !outTime) return null;
  const [ih, im] = inTime.split(":").map(Number);
  const [oh, om] = outTime.split(":").map(Number);
  return (oh * 60 + om - (ih * 60 + im)) / 60;
}

/**
 * Reconstruct a UTC ISO string from the log's date (in company tz) + a "HH:MM" string.
 * Uses the company timezone so the date boundary is correct regardless of viewer's locale.
 */
function buildISO(logTimeIn, timeStr, tz) {
  if (!logTimeIn || !timeStr) return null;
  const dateOnly = new Date(logTimeIn).toLocaleDateString("en-CA", { timeZone: tz || "UTC" }); // "YYYY-MM-DD"
  return new Date(`${dateOnly}T${timeStr}:00`).toISOString();
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ContestDialog({
  open,
  onOpenChange,
  companyTimezone,

  // State values (from PunchLogs parent)
  filteredSorted,
  approvers,

  contestLogId,        setContestLogId,
  contestApproverId,   setContestApproverId,
  contestReason,       setContestReason,
  contestDescription,  setContestDescription,
  contestRequestedClockIn,   setContestRequestedClockIn,   // "HH:MM"
  contestRequestedClockOut,  setContestRequestedClockOut,  // "HH:MM"
  contestSubmitting,
  contestErrors,       setContestErrors,

  onSubmit,   // async (clockInISO, clockOutISO) => void
  onCancel,   // () => void — reset + close
}) {
  const selectedLog = filteredSorted.find((l) => l.id === contestLogId) ?? null;

  const origHours = selectedLog
    ? netHours(toLocalTimeInput(selectedLog.timeIn, companyTimezone), toLocalTimeInput(selectedLog.timeOut, companyTimezone))
    : null;
  const reqHours = netHours(contestRequestedClockIn, contestRequestedClockOut);
  const delta = origHours !== null && reqHours !== null ? reqHours - origHours : null;

  const deltaLabel =
    delta === null
      ? null
      : delta === 0
      ? "No change from recorded"
      : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}h from recorded`;

  const deltaColor =
    delta === null || delta === 0
      ? { bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-600 dark:text-neutral-400" }
      : delta > 0
      ? { bg: "bg-green-100 dark:bg-green-900/40",  text: "text-green-700 dark:text-green-400" }
      : { bg: "bg-red-100 dark:bg-red-900/40",       text: "text-red-700 dark:text-red-400" };

  const handleLogSelect = (id) => {
    setContestLogId(id);
    setContestErrors((e) => ({ ...e, logId: undefined }));
    const log = filteredSorted.find((l) => l.id === id);
    if (log) {
      setContestRequestedClockIn(toLocalTimeInput(log.timeIn, companyTimezone));
      setContestRequestedClockOut(toLocalTimeInput(log.timeOut, companyTimezone));
    }
  };

  const handleSubmit = () => {
    const clockInISO  = buildISO(selectedLog?.timeIn, contestRequestedClockIn,  companyTimezone);
    const clockOutISO = buildISO(selectedLog?.timeIn, contestRequestedClockOut, companyTimezone);
    onSubmit(clockInISO, clockOutISO);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-2 dark:border-white/30 max-h-[90vh] overflow-y-auto">
        <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            Contest clock in/out times
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Corrections are sent to your approver for review before any change is applied.
          </p>
        </DialogHeader>

        <div className="space-y-6 pt-2">

          {/* ── Section 1: Select & correct the log ───────────────────────── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              1 — Select &amp; correct
            </p>

            {/* Log selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-orange-500" />
                Punch log <span className="text-orange-500">*</span>
              </label>
              <Select value={contestLogId} onValueChange={handleLogSelect}>
                <SelectTrigger className={contestErrors.logId ? "border-red-500" : ""}>
                  <SelectValue placeholder="Choose a punch log to contest…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {filteredSorted.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      <div className="flex items-center gap-2">
                        {l.isAnyDA && <Car className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                        <span>
                          {l.timeIn
                            ? new Date(l.timeIn).toLocaleDateString(undefined, {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                          {" · "}
                          {safeTime(l.timeIn, companyTimezone)} – {safeTime(l.timeOut, companyTimezone)}
                          {" · "}
                          {l.duration}h
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contestErrors.logId && (
                <p className="text-red-500 text-xs flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {contestErrors.logId}
                </p>
              )}
            </div>

            {/* Before / after comparison strip */}
            {selectedLog && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border overflow-hidden text-sm">
                  <div className="grid grid-cols-3 bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <span />
                    <span>Clock in</span>
                    <span>Clock out</span>
                  </div>
                  <div className="grid grid-cols-3 px-3 py-2.5 items-center border-t border-border bg-background">
                    <span className="text-xs font-medium text-muted-foreground">Recorded</span>
                    <span className="font-medium tabular-nums">{safeTime(selectedLog.timeIn, companyTimezone)}</span>
                    <span className="font-medium tabular-nums">{safeTime(selectedLog.timeOut, companyTimezone)}</span>
                  </div>
                  <div className="grid grid-cols-3 px-3 py-2.5 items-center border-t border-border bg-orange-50/50 dark:bg-orange-950/20">
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400">Requested</span>
                    <span className="font-medium tabular-nums text-orange-700 dark:text-orange-300">
                      {fmt12(contestRequestedClockIn) || "—"}
                    </span>
                    <span className="font-medium tabular-nums text-orange-700 dark:text-orange-300">
                      {fmt12(contestRequestedClockOut) || "—"}
                    </span>
                  </div>
                </div>

                {deltaLabel && (
                  <div className="flex justify-end">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${deltaColor.bg} ${deltaColor.text}`}>
                      {deltaLabel}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Correct clock in <span className="text-orange-500">*</span>
                    </label>
                    <Input
                      type="time"
                      value={contestRequestedClockIn}
                      onChange={(e) => {
                        setContestRequestedClockIn(e.target.value);
                        setContestErrors((err) => ({ ...err, clockIn: undefined }));
                      }}
                      className={contestErrors.clockIn ? "border-red-500" : ""}
                    />
                    {contestErrors.clockIn && (
                      <p className="text-red-500 text-xs flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {contestErrors.clockIn}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Correct clock out <span className="text-orange-500">*</span>
                    </label>
                    <Input
                      type="time"
                      value={contestRequestedClockOut}
                      onChange={(e) => {
                        setContestRequestedClockOut(e.target.value);
                        setContestErrors((err) => ({ ...err, clockOut: undefined }));
                      }}
                      className={contestErrors.clockOut ? "border-red-500" : ""}
                    />
                    {contestErrors.clockOut && (
                      <p className="text-red-500 text-xs flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {contestErrors.clockOut}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: Approver & reason ──────────────────────────────── */}
          {selectedLog && (
            <div className="space-y-4 border-t pt-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                2 — Approver &amp; reason
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-orange-500" />
                  Approver <span className="text-orange-500">*</span>
                </label>
                <Select
                  value={contestApproverId}
                  onValueChange={(v) => {
                    setContestApproverId(v);
                    setContestErrors((e) => ({ ...e, approverId: undefined }));
                  }}
                >
                  <SelectTrigger className={contestErrors.approverId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select approver…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {approvers.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name || a.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contestErrors.approverId && (
                  <p className="text-red-500 text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {contestErrors.approverId}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  Reason <span className="text-orange-500">*</span>
                </label>
                <Select
                  value={contestReason}
                  onValueChange={(v) => {
                    setContestReason(v);
                    setContestErrors((e) => ({ ...e, reason: undefined }));
                  }}
                >
                  <SelectTrigger className={contestErrors.reason ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "system_clock_error",
                      "device_malfunction",
                      "network_delay",
                      "incorrect_time_zone",
                      "manual_entry_error",
                      "emergency_situation",
                      "other",
                    ].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contestErrors.reason && (
                  <p className="text-red-500 text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {contestErrors.reason}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-orange-500" />
                  Detailed explanation <span className="text-orange-500">*</span>
                </label>
                <Textarea
                  value={contestDescription}
                  onChange={(e) => {
                    setContestDescription(e.target.value);
                    setContestErrors((err) => ({ ...err, description: undefined }));
                  }}
                  placeholder="Explain why the recorded times are incorrect…"
                  className={`min-h-[100px] resize-none ${contestErrors.description ? "border-red-500" : ""}`}
                  maxLength={500}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {contestErrors.description && (
                      <span className="text-red-500">{contestErrors.description}</span>
                    )}
                  </span>
                  <span>{contestDescription.length}/500</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={contestSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              contestSubmitting ||
              !contestLogId ||
              !contestApproverId ||
              !contestReason ||
              !contestDescription.trim() ||
              !contestRequestedClockIn ||
              !contestRequestedClockOut
            }
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {contestSubmitting ? "Submitting…" : "Submit contest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
