/* components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/TaskReportDialog.jsx */
"use client";

// BB-129: clock-out documentation (Daily Task Report), trial.
// One report per day (the company-zone day of the clock-in). Input form only: the PDF
// layout is never previewed here, it exists only after submit (View / Download).
// The server keeps a submitted report submitted, so after the first submit there is
// one "Save" button that always sends submit: true.

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, ExternalLink, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  TASK_LIMITS, getMyReport, saveMyReport, myReportPdfPath,
  fmtTimeInZone, fmtDateTimeInZone, fmtReportDate,
} from "@/lib/taskReportsApi";
import { downloadServerReport, openServerReport } from "@/lib/reportDownload";

let keySeq = 0;
const newKey = () => `t${++keySeq}`;
const toRows = (tasks = []) => tasks.map((t) => ({ key: newKey(), title: t.title || "", note: t.note || "" }));
const snapshot = (rows) => JSON.stringify(rows.map((r) => [r.title.trim(), r.note.trim()]));

export default function TaskReportDialog({ open, onOpenChange, date, apiUrl, token, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [data, setData] = useState(null);       // GET /me/:date data
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState({});     // key → message
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(null);   // "draft" | "submit" | null
  const [pdfBusy, setPdfBusy] = useState(null); // "view" | "download" | null
  const savedRef = useRef(snapshot([]));

  // ── Load the day ──
  useEffect(() => {
    if (!open || !date || !token) return;
    let cancelled = false;
    setLoading(true); setLoadError(null); setData(null); setErrors({}); setFormError(null);
    getMyReport(apiUrl, token, date)
      .then((d) => {
        if (cancelled) return;
        const initial = toRows(d?.report?.tasks);
        setData(d);
        setRows(initial.length || !d?.canEdit ? initial : [{ key: newKey(), title: "", note: "" }]);
        savedRef.current = snapshot(initial);
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, date, token, apiUrl]);

  const report = data?.report || null;
  const tz = data?.timeZone;
  const att = data?.attendance;
  const canEdit = Boolean(data?.canEdit);
  const submitted = report?.status === "submitted";
  const dirty = snapshot(rows.filter((r) => r.title.trim() || r.note.trim())) !== savedRef.current;
  const busy = Boolean(saving);

  const readOnlyReason = !data || canEdit
    ? null
    : !data.enabled
      ? "Clock-out documentation is turned off for your company, so this report can't be changed."
      : data.mode === "forms" // BB-129 phase 2: Custom forms mode turns the free-form report off
        ? "Your company now uses questionnaires after clock-out, so daily task reports can't be written or changed. This one stays as it was."
        : "There is no punch on this day, so there is nothing to document.";

  // ── Row editing ──
  const update = (key, field, value) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    setFormError(null);
  };
  const add = () => setRows((rs) => (rs.length >= TASK_LIMITS.maxTasks ? rs : [...rs, { key: newKey(), title: "", note: "" }]));
  const remove = (key) => setRows((rs) => rs.filter((r) => r.key !== key));
  const move = (index, dir) => setRows((rs) => {
    const j = index + dir;
    if (j < 0 || j >= rs.length) return rs;
    const n = [...rs];
    [n[index], n[j]] = [n[j], n[index]];
    return n;
  });

  // ── Save / submit ──
  const save = async (submit) => {
    // Rows left completely empty are dropped; a note without a title is an error.
    const kept = rows.filter((r) => r.title.trim() || r.note.trim());
    const errs = {};
    kept.forEach((r) => { if (!r.title.trim()) errs[r.key] = "Add a title for this task."; });
    setErrors(errs);
    if (Object.keys(errs).length) { setFormError("Some tasks need a title."); return; }
    if (submit && !kept.length) { setFormError("Add at least one task before submitting."); return; }

    setSaving(submit ? "submit" : "draft");
    setFormError(null);
    try {
      const tasks = kept.map((r) => ({ title: r.title.trim(), note: r.note.trim() }));
      const res = await saveMyReport(apiUrl, token, date, { tasks, submit });
      const saved = res.data;
      setData((d) => ({ ...d, report: saved }));
      const nextRows = toRows(saved?.tasks);
      setRows(nextRows.length ? nextRows : [{ key: newKey(), title: "", note: "" }]);
      savedRef.current = snapshot(nextRows);
      toast.success(res.message || (submit ? "Report submitted." : "Report saved."));
      onSaved?.(date, saved);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(null);
    }
  };

  // ── PDF (submitted only) ──
  const pdf = async (mode) => {
    setPdfBusy(mode);
    try {
      if (mode === "view") await openServerReport({ apiUrl, token, path: myReportPdfPath(date) });
      else await downloadServerReport({ apiUrl, token, path: myReportPdfPath(date), fallbackFilename: `DailyTaskReport_${date}.pdf` });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPdfBusy(null);
    }
  };

  // Unsaved typing is kept: clicking outside or pressing Esc doesn't close while there are changes.
  const guardClose = (e) => { if (dirty && canEdit) e.preventDefault(); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0"
        onInteractOutside={guardClose}
        onEscapeKeyDown={guardClose}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Daily task report</DialogTitle>
          <DialogDescription>
            {fmtReportDate(date)} · List the work you did this day. Optional during the trial.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : data ? (
            <>
              {/* Attendance (company zone) */}
              {att && (
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Clock in</dt>
                    <dd>{fmtTimeInZone(att.clockIn, tz)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Clock out</dt>
                    <dd>{att.stillClockedIn ? "Still clocked in" : fmtTimeInZone(att.clockOut, tz)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Shift</dt>
                    <dd>{att.shift ? `${att.shift.name ? `${att.shift.name}, ` : ""}${att.shift.start}–${att.shift.end}` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Punches</dt>
                    <dd>{att.punchCount}</dd>
                  </div>
                </dl>
              )}

              {/* Status + PDF */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  {submitted
                    ? <>Submitted {fmtDateTimeInZone(report.submittedAt, tz)}</>
                    : report
                      ? "Draft, only you can see it. The PDF is made after you submit."
                      : "Not started. The PDF is made after you submit."}
                </p>
                {submitted && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => pdf("view")} disabled={Boolean(pdfBusy)}>
                      {pdfBusy === "view" ? <Loader2 className="animate-spin" /> : <ExternalLink />} View PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => pdf("download")} disabled={Boolean(pdfBusy)}>
                      {pdfBusy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Download
                    </Button>
                  </div>
                )}
              </div>
              {submitted && dirty && (
                <p className="text-xs text-muted-foreground">The PDF shows the last saved version. Save to update it.</p>
              )}

              {readOnlyReason && <p className="text-sm text-muted-foreground">{readOnlyReason}</p>}

              {/* Tasks */}
              {rows.length === 0 && !canEdit ? (
                <p className="text-sm text-muted-foreground">No tasks.</p>
              ) : (
                <ol className="space-y-3">
                  {rows.map((r, i) => (
                    <li key={r.key} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`task-title-${r.key}`} className="text-xs text-muted-foreground">
                          Task {i + 1}
                        </Label>
                        {canEdit && (
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Move up"
                              onClick={() => move(i, -1)} disabled={busy || i === 0}>
                              <ArrowUp />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Move down"
                              onClick={() => move(i, 1)} disabled={busy || i === rows.length - 1}>
                              <ArrowDown />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive" aria-label="Remove task"
                              onClick={() => remove(r.key)} disabled={busy}>
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </div>
                      {canEdit ? (
                        <>
                          <Input
                            id={`task-title-${r.key}`}
                            value={r.title}
                            maxLength={TASK_LIMITS.title}
                            placeholder="What did you work on?"
                            onChange={(e) => update(r.key, "title", e.target.value)}
                            disabled={busy}
                            aria-invalid={Boolean(errors[r.key])}
                          />
                          {errors[r.key] && <p className="text-xs text-destructive">{errors[r.key]}</p>}
                          <Textarea
                            value={r.note}
                            maxLength={TASK_LIMITS.note}
                            rows={2}
                            placeholder="Note (optional)"
                            onChange={(e) => update(r.key, "note", e.target.value)}
                            disabled={busy}
                          />
                          {r.note.length > TASK_LIMITS.note - 100 && (
                            <p className="text-xs text-muted-foreground text-right">{r.note.length}/{TASK_LIMITS.note}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium">{r.title}</p>
                          {r.note && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.note}</p>}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {canEdit && (
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={add} disabled={busy || rows.length >= TASK_LIMITS.maxTasks}>
                    <Plus /> Add task
                  </Button>
                  <span className="text-xs text-muted-foreground">{rows.length}/{TASK_LIMITS.maxTasks} tasks</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        <Separator />

        <DialogFooter className="px-6 py-4 gap-2 sm:items-center">
          {formError && <p className="text-sm text-destructive sm:mr-auto">{formError}</p>}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {canEdit ? "Cancel" : "Close"}
          </Button>
          {canEdit && !submitted && (
            <Button variant="outline" onClick={() => save(false)} disabled={busy || loading || !dirty}>
              {saving === "draft" && <Loader2 className="animate-spin" />} Save draft
            </Button>
          )}
          {canEdit && (
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => save(true)}
              disabled={busy || loading || (submitted && !dirty)}
            >
              {saving === "submit" && <Loader2 className="animate-spin" />} {submitted ? "Save" : "Submit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
