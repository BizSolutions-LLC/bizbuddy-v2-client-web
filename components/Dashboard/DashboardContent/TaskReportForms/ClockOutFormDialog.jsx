"use client";
// components/Dashboard/DashboardContent/TaskReportForms/ClockOutFormDialog.jsx
//
// BB-141: the end-of-shift questionnaire answered BEFORE clock-out. The server now
// needs the answers in the /time-out body when a form applies to the open punch
// (400 TASK_REPORT_FORMS_REQUIRED otherwise), so the employee fills the form here and
// "Submit and time out" sends the answers with the punch. Nothing is saved until the
// clock-out goes through; closing this keeps the employee clocked in.
// The form comes from GET /api/task-report-forms/me/open.

import { useEffect, useMemo, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toAnswerPayload, validateAnswers, isAnswered } from "@/lib/taskReportFormsApi";
import { QuestionField } from "./TaskReportFormFields";

export default function ClockOutFormDialog({ open, form, shiftName, submitting, error, onCancel, onSubmit }) {
  const questions = useMemo(() => form?.questions || [], [form]);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({}); // questionId → message
  const [formError, setFormError] = useState(null);

  // A new form (new clock-out attempt) starts empty
  useEffect(() => {
    if (open) { setValues({}); setErrors({}); setFormError(null); }
  }, [open, form]);

  const answeredCount = questions.filter((q) => isAnswered(q, values[q.id])).length;
  const dirty = answeredCount > 0;

  const setValue = (id, v) => {
    setValues((s) => ({ ...s, [id]: v }));
    if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
    setFormError(null);
  };

  const submit = () => {
    const errs = validateAnswers(questions, values, { submit: true });
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Answer the required questions before timing out.");
      const first = questions.find((q) => errs[q.id]);
      if (first) document.getElementById(`answer-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSubmit(toAnswerPayload(questions, values));
  };

  // Typed answers are kept: clicking outside or pressing Esc doesn't close while there are any.
  const guardClose = (e) => { if (dirty || submitting) e.preventDefault(); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onCancel(); }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0"
        onInteractOutside={guardClose}
        onEscapeKeyDown={guardClose}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="pr-6">{form?.name || "End-of-shift questionnaire"}</DialogTitle>
          <DialogDescription>
            Answer this before you time out{shiftName ? ` (${shiftName})` : ""}. Your answers are submitted with
            your time out and can&apos;t be changed afterwards.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {form?.description?.trim() && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{form.description.trim()}</p>
          )}
          {questions.some((q) => q.required) && (
            <p className="text-xs text-muted-foreground"><span className="text-destructive">*</span> Required</p>
          )}
          <div className="space-y-6">
            {questions.map((q, i) => (
              <div key={q.id} className="border-t pt-5 first:border-t-0 first:pt-0">
                <QuestionField
                  q={q}
                  index={i}
                  value={values[q.id]}
                  onChange={(v) => setValue(q.id, v)}
                  disabled={submitting}
                  error={errors[q.id]}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <DialogFooter className="px-6 py-4 gap-2 sm:items-center">
          <div className="sm:mr-auto text-sm">
            {formError || error
              ? <p className="text-destructive">{formError || error}</p>
              : <p className="text-muted-foreground">{answeredCount} of {questions.length} answered</p>}
          </div>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Stay clocked in
          </Button>
          <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <LogOut />} Submit and time out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
