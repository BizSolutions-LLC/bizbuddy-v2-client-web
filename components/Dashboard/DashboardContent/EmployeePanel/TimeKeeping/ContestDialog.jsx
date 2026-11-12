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
 *
 * BB-123: every time here is a wall-clock time in the COMPANY zone (not the viewer's
 * browser zone). Overnight clock-outs roll to the next day, large moves get a warning,
 * locked-cutoff punches can't be picked, and 24h+ shifts are blocked before submit.
 * The zone math lives in lib/contestTimes.js (shared with the approver page).
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
import {
  zoneLabel,
  dateInZone,
  buildContestTimes,
  lengthHours,
  contestChange,
  fmtSignedHours,
  fmtHours,
  isLogInLockedCutoff,
} from "@/lib/contestTimes";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format a JS Date (or timestamp string) to "HH:MM" in the given timezone. */
export function toLocalTimeInput(dateStr, tz) {
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


// ── Component ──────────────────────────────────────────────────────────────────

export function ContestDialog({
  open,
  onOpenChange,
  companyTimezone,

  // State values (from PunchLogs parent)
  filteredSorted,
  pendingContestLogIds = new Set(), // BB-123: punches that already have a pending contest
  approvers,
  supervisors = [],

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

  // Requested times as real instants in the company zone (clock-out rolls to the next
  // day when it's at or before the clock-in — a normal overnight shift).
  const requested = buildContestTimes(
    selectedLog?.timeIn, contestRequestedClockIn, contestRequestedClockOut, companyTimezone
  );
  const outIsNextDay =
    !!(requested.clockIn && requested.clockOut) &&
    dateInZone(requested.clockOut, companyTimezone) !== dateInZone(requested.clockIn, companyTimezone);

  const origHours = selectedLog ? lengthHours(selectedLog.timeIn, selectedLog.timeOut) : null;
  const reqHours  = requested.hours;
  const delta = origHours !== null && reqHours !== null ? reqHours - origHours : null;

  const deltaLabel =
    delta === null
      ? null
      : Math.abs(delta) < 1 / 60 // both lengths are minute-precision; under a minute = no change
      ? "No change from recorded"
      : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}h from recorded`;

  // Zone label shown with the time fields and the comparison strip — from companyTimezone,
  // with the abbreviation in effect on the punch's own date (PST vs PDT).
  const tzLabel = zoneLabel(companyTimezone, selectedLog?.timeIn);

  // Large-move warning: compares the requested clock-in with the recorded clock-in only.
  const change = selectedLog
    ? contestChange(
        { origIn: selectedLog.timeIn, origOut: selectedLog.timeOut, reqIn: requested.clockIn, reqOut: requested.clockOut },
        companyTimezone
      )
    : null;

  const deltaColor =
    delta === null || Math.abs(delta) < 1 / 60
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
    // Mirrors the server's 400: a shift can't be 24 hours or longer.
    if (requested.hours != null && requested.hours >= 24) {
      setContestErrors((e) => ({
        ...e,
        clockOut: "A shift can't be 24 hours or longer. Check the clock-in and clock-out times.",
      }));
      return;
    }
    onSubmit(requested.clockIn, requested.clockOut);
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
                  {filteredSorted.map((l) => {
                    const locked = isLogInLockedCutoff(l);
                    const pending = !locked && pendingContestLogIds.has(l.id);
                    return (
                      <SelectItem key={l.id} value={String(l.id)} disabled={locked || pending}>
                        <div className="flex items-center gap-2">
                          {l.isAnyDA && <Car className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                          <span>
                            {l.timeIn
                              ? new Date(l.timeIn).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  ...(companyTimezone ? { timeZone: companyTimezone } : {}),
                                })
                              : "—"}
                            {" · "}
                            {safeTime(l.timeIn, companyTimezone)} – {safeTime(l.timeOut, companyTimezone)}
                            {" · "}
                            {l.duration}h
                          </span>
                          {locked && (
                            <span className="text-xs text-muted-foreground">· Locked (cutoff closed)</span>
                          )}
                          {pending && (
                            <span className="text-xs text-muted-foreground">· Contest pending</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
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
                    <span className="truncate" title={`Times in ${tzLabel}`}>{tzLabel}</span>
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
                      {outIsNextDay && (
                        <span className="ml-1 text-[10px] font-medium text-muted-foreground">(next day)</span>
                      )}
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

                {/* Large-move warning — informational, never blocks submit */}
                {change?.large && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p>
                        {change.movesDate
                          ? "This moves the punch to another day."
                          : `This moves the clock-in by about ${fmtHours(Math.abs(change.inShift))} (${fmtSignedHours(change.inShift)}).`}
                        {" "}Check the times are in {tzLabel}.
                      </p>
                      {change.movesDate && (
                        <p>To add a missing day, use Request Punch Log instead of contesting another day&apos;s punch.</p>
                      )}
                    </div>
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
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  All times are in the company time zone ({tzLabel}).
                  {" "}A clock-out earlier than the clock-in counts as the next day.
                </p>
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
                    {supervisors.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Team Supervisors</div>
                        {supervisors.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name || s.email}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {approvers.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Approvers</div>
                        {approvers.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.name || a.email}
                          </SelectItem>
                        ))}
                      </>
                    )}
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
