"use client";
// components/Dashboard/DashboardContent/TaskReportForms/TaskReportFormAnswerDialog.jsx
//
// BB-129 phase 2: the employee answers the questionnaire for one punch (timeLogId).
// Opened by the pop-up after clock-out, the Punch logs row icon, or the pending list.
// Save draft keeps answers editable; Submit locks them. Required questions are checked
// on submit only. When the answer window ends the server locks a draft as Incomplete.
// The server owns every rule; this only shows its state and sends answers.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  getMyPunchForm, saveMyPunchForm, fromServerAnswers, toAnswerPayload, validateAnswers, isAnswered,
  RESPONSE_STATUS_LABEL, responsePdfPath,
} from "@/lib/taskReportFormsApi";
import { downloadServerReport, openServerReport } from "@/lib/reportDownload";
import { fmtTimeInZone, fmtDateTimeInZone } from "@/lib/taskReportsApi";
import { QuestionField } from "./TaskReportFormFields";

const RELOAD_CODES = new Set(["RESPONSE_CONFLICT", "RESPONSE_LOCKED", "RESPONSE_CLOSED", "TASK_REPORT_FORMS_OFF"]);

export function fmtDateInZone(value, timeZone) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone });
  } catch { return "—"; }
}

export function ResponseStatusBadge({ status }) {
  if (!status) return <Badge variant="outline">Not started</Badge>;
  return (
    <Badge variant={status === "submitted" ? "outline" : "secondary"}
      className={status === "submitted" ? "text-green-700 border-green-300 dark:text-green-400 dark:border-green-800" : ""}>
      {RESPONSE_STATUS_LABEL[status] || status}
    </Badge>
  );
}

// View / Download PDF for a submitted answer set (section 10). Shared with Employee Report.
export function ResponsePdfButtons({ apiUrl, token, responseId, punchDate }) {
  const [busy, setBusy] = useState(null); // "view" | "download" | null
  const run = async (mode) => {
    setBusy(mode);
    try {
      if (mode === "view") await openServerReport({ apiUrl, token, path: responsePdfPath(responseId, { inline: true }) });
      else await downloadServerReport({
        apiUrl, token, path: responsePdfPath(responseId),
        fallbackFilename: `Questionnaire${punchDate ? `_${punchDate}` : ""}.pdf`,
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => run("view")} disabled={Boolean(busy)}>
        {busy === "view" ? <Loader2 className="animate-spin" /> : <ExternalLink />} View PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => run("download")} disabled={Boolean(busy)}>
        {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Download
      </Button>
    </div>
  );
}

// "YYYY-MM-DD" of a timestamp in the company zone (for the PDF file name).
const ymdInZone = (value, timeZone) => {
  if (!value) return "";
  try { return new Date(value).toLocaleDateString("en-CA", { timeZone }); } catch { return ""; }
};

export default function TaskReportFormAnswerDialog({ open, onOpenChange, timeLogId, apiUrl, token, onSaved, intro }) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});       // questionId → message
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(null);     // "draft" | "submit" | null
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const savedRef = useRef("{}");

  const questions = useMemo(() => data?.form?.questions || [], [data]);
  const snap = useCallback((v) => JSON.stringify(toAnswerPayload(questions, v)), [questions]);

  // ── Load ──
  const load = useCallback(async ({ keepError = false } = {}) => {
    if (!timeLogId || !token) return;
    setLoading(true); setLoadError(null);
    if (!keepError) setFormError(null);
    setErrors({}); setConfirmSubmit(false);
    try {
      const d = await getMyPunchForm(apiUrl, token, timeLogId);
      const v = fromServerAnswers(d?.form?.questions, d?.response?.answers);
      setData(d);
      setValues(v);
      savedRef.current = JSON.stringify(toAnswerPayload(d?.form?.questions || [], v));
    } catch (e) {
      setData(null);
      setLoadError(e.message);
    }
    setLoading(false);
  }, [apiUrl, token, timeLogId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const tz = data?.timeZone;
  const response = data?.response || null;
  const status = response?.status || null;
  const canEdit = Boolean(data?.canEdit);
  const dirty = canEdit && snap(values) !== savedRef.current;
  const busy = Boolean(saving);
  const answeredCount = questions.filter((q) => isAnswered(q, values[q.id])).length;

  const readOnlyReason = !data || canEdit
    ? null
    : status === "submitted"
      ? `Submitted ${fmtDateTimeInZone(response.submittedAt, tz)}. Your answers are locked.`
      : status === "incomplete"
        ? "The time to answer ended before this was submitted, so it's locked as Incomplete."
        : data.enabled === false
          ? "Questionnaires are turned off for your company, so this can't be answered."
          : "This questionnaire can't be answered anymore.";

  const setValue = (id, v) => {
    setValues((s) => ({ ...s, [id]: v }));
    if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
    setFormError(null);
    setConfirmSubmit(false);
  };

  // ── Save / submit ──
  const save = async (submit) => {
    const errs = validateAnswers(questions, values, { submit });
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError(submit ? "Answer the required questions before submitting." : "Fix the highlighted answers.");
      setConfirmSubmit(false);
      const first = questions.find((q) => errs[q.id]);
      if (first) document.getElementById(`answer-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (submit && !confirmSubmit) { setConfirmSubmit(true); return; }

    setSaving(submit ? "submit" : "draft");
    setFormError(null);
    try {
      const res = await saveMyPunchForm(apiUrl, token, timeLogId, { answers: toAnswerPayload(questions, values), submit });
      const saved = res.data;
      const v = fromServerAnswers(questions, saved?.answers);
      setData((d) => ({ ...d, response: saved, canEdit: saved?.status === "draft" ? d.canEdit : false }));
      setValues(v);
      savedRef.current = snap(v);
      setConfirmSubmit(false);
      toast.success(res.message || (submit ? "Questionnaire submitted." : "Draft saved."));
      onSaved?.(timeLogId, saved);
    } catch (e) {
      setFormError(e.message);
      setConfirmSubmit(false);
      // Saved elsewhere, already submitted, window closed or turned off: show the server's current state.
      if (RELOAD_CODES.has(e.code)) {
        await load({ keepError: true });
        onSaved?.(timeLogId, null);
      }
    } finally {
      setSaving(null);
    }
  };

  // Unsaved answers are kept: clicking outside or pressing Esc doesn't close while there are changes.
  const guardClose = (e) => { if (dirty) e.preventDefault(); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0"
        onInteractOutside={guardClose}
        onEscapeKeyDown={guardClose}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
            {data?.form?.name || "Questionnaire"}
            {data && <ResponseStatusBadge status={status} />}
          </DialogTitle>
          <DialogDescription>
            {intro || "Answer the questionnaire for this punch."}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loading && !data ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : loadError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw /> Try again</Button>
            </div>
          ) : data ? (
            <>
              {/* Punch (company zone) */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Date</dt>
                  <dd>{fmtDateInZone(data.punch?.timeIn, tz)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Clock in – out</dt>
                  <dd>{fmtTimeInZone(data.punch?.timeIn, tz)} – {fmtTimeInZone(data.punch?.timeOut, tz)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Shift</dt>
                  <dd>{data.shiftName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{canEdit ? "Closes" : "Closed"}</dt>
                  <dd>{fmtDateTimeInZone(data.closesAt, tz)}</dd>
                </div>
              </dl>

              {data.form?.description?.trim() && (
                <p className="text-sm text-muted-foreground whitespace-pre-line border-t pt-3">{data.form.description.trim()}</p>
              )}

              {status === "submitted" && response?.id && (
                <ResponsePdfButtons apiUrl={apiUrl} token={token} responseId={response.id} punchDate={ymdInZone(data.punch?.timeIn, tz)} />
              )}

              {readOnlyReason ? (
                <p className="text-sm text-muted-foreground border-l-2 border-orange-500 pl-3">{readOnlyReason}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {questions.some((q) => q.required) && <><span className="text-destructive">*</span> Required · </>}
                  {status === "draft" ? "Draft, only you can see it. " : ""}
                  Submitting locks your answers.
                </p>
              )}

              <div className="space-y-6">
                {questions.map((q, i) => (
                  <div key={q.id} className="border-t pt-5 first:border-t-0 first:pt-0">
                    <QuestionField
                      q={q}
                      index={i}
                      value={values[q.id]}
                      onChange={(v) => setValue(q.id, v)}
                      disabled={!canEdit || busy}
                      error={errors[q.id]}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <Separator />

        <DialogFooter className="px-6 py-4 gap-2 sm:items-center">
          <div className="sm:mr-auto text-sm">
            {formError
              ? <p className="text-destructive">{formError}</p>
              : confirmSubmit
                ? <p className="text-foreground">Submit now? You can't change your answers after this.</p>
                : data && canEdit && <p className="text-muted-foreground">{answeredCount} of {questions.length} answered</p>}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {canEdit ? (dirty ? "Cancel" : "Answer later") : "Close"}
          </Button>
          {canEdit && (
            <Button variant="outline" onClick={() => save(false)} disabled={busy || loading || !dirty}>
              {saving === "draft" && <Loader2 className="animate-spin" />} Save draft
            </Button>
          )}
          {canEdit && (
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => save(true)} disabled={busy || loading}>
              {saving === "submit" && <Loader2 className="animate-spin" />} {confirmSubmit ? "Yes, submit" : "Submit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
