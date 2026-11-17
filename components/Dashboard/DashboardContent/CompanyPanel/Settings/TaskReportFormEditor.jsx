"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/TaskReportFormEditor.jsx
//
// BB-129 phase 1: build or edit one custom clock-out form (admin / superadmin only).
// formId "new" creates a form. Question ids from the server are kept and sent back on save
// (later answers will point at them); new questions carry a temporary id until saved.
// Archived forms are read-only: Restore or Duplicate only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowUp, ArrowDown, Copy, Trash2, Plus, Save, Loader2, Eye, Pencil, Archive, ArchiveRestore, X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getForm, createForm, updateForm, duplicateForm, archiveForm, restoreForm,
  FORM_LIMITS, QUESTION_TYPES, isChoiceType, questionTypeLabel, newTempId,
  toFormPayload, validateForm, hasErrors, listAssignments, deleteAssignment, scopeRank,
} from "@/lib/taskReportFormsApi";
import { AssignFormDialog, AssignmentTarget, RemoveAssignmentDialog, targetText } from "./TaskReportFormAssignments";
import { useFormsAccess, FORMS_BASE, DuplicateFormDialog, formatWhen } from "./TaskReportForms";
import TaskReportFormPreview from "./TaskReportFormPreview";

const L = FORM_LIMITS;
const EMPTY_DRAFT = { name: "", description: "", questions: [] };

// Server question → editor question (options always an array of strings).
const fromServer = (form) => ({
  name: form?.name || "",
  description: form?.description || "",
  questions: (form?.questions || []).map((q) => ({
    id: q.id,
    type: q.type,
    label: q.label || "",
    helpText: q.helpText || "",
    required: Boolean(q.required),
    options: Array.isArray(q.options) ? q.options.map(String) : [],
  })),
});

const newQuestion = (type) => ({
  id: newTempId(),
  type,
  label: "",
  helpText: "",
  required: false,
  options: isChoiceType(type) ? ["Option 1"] : [],
});

// Snapshot used to tell whether there are unsaved changes.
const snapshot = (d) => JSON.stringify(toFormPayload(d));

// "12/120" shown once a field is close to its limit.
function Counter({ value, max }) {
  const n = (value || "").length;
  if (n < max * 0.8) return null;
  return <span className={`text-[11px] tabular-nums ${n > max ? "text-destructive" : "text-muted-foreground"}`}>{n}/{max}</span>;
}

export default function TaskReportFormEditor({ formId }) {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const allowed = useFormsAccess();
  const isNew = formId === "new";

  const [form, setForm] = useState(null);         // server object (meta + status); null for a new form
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saved, setSaved] = useState(snapshot(EMPTY_DRAFT));
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);        // archive / restore / duplicate
  const [view, setView] = useState("edit");       // "edit" | "preview"
  const [showErrors, setShowErrors] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupName, setDupName] = useState("");
  // BB-129 phase 2: assignments of this form
  const [assignOpen, setAssignOpen] = useState(false);
  const [allAssignments, setAllAssignments] = useState([]); // every rule, for "replaces …" hints
  const [removeAssignment, setRemoveAssignment] = useState(null);
  const [removingAssignment, setRemovingAssignment] = useState(false);
  const lastAddedRef = useRef(null);

  const archived = form?.status === "archived";
  const readOnly = archived;
  const dirty = !readOnly && snapshot(draft) !== saved;
  const validation = useMemo(() => validateForm(draft), [draft]);

  const applyServerForm = useCallback((f) => {
    const d = fromServer(f);
    // Save / archive responses may leave out assignments, responseCount, canDelete: keep the ones we have.
    setForm((prev) => (prev && prev.id === f?.id ? { ...prev, ...f } : f));
    setDraft(d);
    setSaved(snapshot(d));
    setShowErrors(false);
  }, []);

  // ── Load ──
  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true); setLoadError(null);
    try {
      applyServerForm(await getForm(API, token, formId));
    } catch (e) {
      setLoadError(e.message);
      if (e.status === 403) window.location.href = "/dashboard";
    }
    setLoading(false);
  }, [API, token, formId, isNew, applyServerForm]);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  // Archived forms open straight in the read-only view.
  useEffect(() => { if (archived) setView("preview"); }, [archived]);

  // ── Unsaved-changes guard ──
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const goBack = () => { if (dirty) setLeaveOpen(true); else router.push(FORMS_BASE); };

  // Scroll the newest question into view.
  useEffect(() => {
    if (!lastAddedRef.current) return;
    const el = document.getElementById(`q-${lastAddedRef.current}`);
    lastAddedRef.current = null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector("input")?.focus({ preventScroll: true });
  }, [draft.questions.length]);

  // ── Draft edits ──
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const patchQ = (id, patch) => setDraft((d) => ({ ...d, questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  const addQ = (type) => {
    if (draft.questions.length >= L.maxQuestions) return;
    const q = newQuestion(type);
    lastAddedRef.current = q.id;
    setDraft((d) => ({ ...d, questions: [...d.questions, q] }));
  };
  const removeQ = (id) => setDraft((d) => ({ ...d, questions: d.questions.filter((q) => q.id !== id) }));
  const moveQ = (idx, dir) => setDraft((d) => {
    const qs = [...d.questions];
    const j = idx + dir;
    if (j < 0 || j >= qs.length) return d;
    [qs[idx], qs[j]] = [qs[j], qs[idx]];
    return { ...d, questions: qs };
  });
  const duplicateQ = (idx) => {
    if (draft.questions.length >= L.maxQuestions) return;
    const src = draft.questions[idx];
    const copy = { ...src, id: newTempId(), options: [...src.options] };
    lastAddedRef.current = copy.id;
    setDraft((d) => {
      const qs = [...d.questions];
      qs.splice(idx + 1, 0, copy);
      return { ...d, questions: qs };
    });
  };
  const changeType = (q, type) => {
    // Keep typed options when switching between choice types; seed one when switching to a choice type.
    const options = isChoiceType(type) && q.options.length === 0 ? ["Option 1"] : q.options;
    patchQ(q.id, { type, options });
  };

  // ── Save ──
  const save = async () => {
    if (hasErrors(validation)) {
      setShowErrors(true);
      toast.error("Fix the highlighted fields before saving.");
      return;
    }
    setSaving(true);
    try {
      const body = toFormPayload(draft);
      if (isNew) {
        const created = await createForm(API, token, body);
        applyServerForm(created);
        toast.success("Form created");
        router.replace(`${FORMS_BASE}/${created.id}`);
      } else {
        applyServerForm(await updateForm(API, token, form.id, body));
        toast.success("Form saved");
      }
    } catch (e) {
      toast.error(e.message);
      if (e.code === "FORM_ARCHIVED") load(); // someone archived it meanwhile: reload as read-only
    }
    setSaving(false);
  };

  const discard = () => { if (form) applyServerForm(form); else { setDraft(EMPTY_DRAFT); setShowErrors(false); } };

  // ── Archive / restore / duplicate (saved forms only) ──
  const onArchive = async () => {
    setBusy(true);
    try {
      await archiveForm(API, token, form.id);
      toast.success("Form archived");
      await load();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const onRestore = async () => {
    setBusy(true);
    try {
      await restoreForm(API, token, form.id);
      toast.success("Form restored");
      setView("edit");
      await load();
    } catch (e) {
      if (e.code === "FORM_NAME_TAKEN") {
        toast.error(e.message, { description: "Rename the active form with that name, or duplicate this one instead." });
      } else toast.error(e.message);
    }
    setBusy(false);
  };
  const onDuplicate = async () => {
    setBusy(true);
    try {
      const copy = await duplicateForm(API, token, form.id, dupName);
      toast.success(`Created "${copy?.name || "copy"}"`);
      setDupOpen(false);
      router.push(`${FORMS_BASE}/${copy.id}`);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  // ── Assignments (BB-129 phase 2) ──
  // Only the assignment list is refreshed, so unsaved edits to the questions are kept.
  const refreshAssignments = async () => {
    try {
      const fresh = await getForm(API, token, form.id);
      setForm((prev) => ({ ...prev, assignments: fresh.assignments, responseCount: fresh.responseCount, canDelete: fresh.canDelete }));
    } catch (e) { toast.error(e.message); }
  };
  const openAssign = () => {
    setAssignOpen(true);
    listAssignments(API, token).then((r) => setAllAssignments(r.data)).catch(() => setAllAssignments([]));
  };
  const onRemoveAssignment = async () => {
    setRemovingAssignment(true);
    try {
      await deleteAssignment(API, token, removeAssignment.id);
      toast.success("Assignment removed");
      setRemoveAssignment(null);
      await refreshAssignments();
    } catch (e) { toast.error(e.message); }
    setRemovingAssignment(false);
  };
  const assignments = [...(form?.assignments || [])]
    .sort((a, b) => scopeRank(a.scope) - scopeRank(b.scope) || targetText(a).localeCompare(targetText(b)));

  // ── Render ──
  if (!allowed || loading) {
    return (
      <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => router.push(FORMS_BASE)}><ArrowLeft /> Back to forms</Button>
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const qErrors = showErrors ? validation.questions : {};
  const atMax = draft.questions.length >= L.maxQuestions;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto pb-28">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground" onClick={goBack}>
            <ArrowLeft /> Clock-out Forms
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <span className="truncate">{isNew ? "New form" : form?.name || "Form"}</span>
            {form && <Badge variant={archived ? "secondary" : "outline"}>{archived ? "Archived" : "Active"}</Badge>}
          </h1>
          {form && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated {formatWhen(form.updatedAt)}
              {(form.updatedBy?.name || form.createdBy?.name) && <> by {form.updatedBy?.name || form.createdBy?.name}</>}
              {form.responseCount > 0 && (
                <> · {form.responseCount} answer set{form.responseCount === 1 ? "" : "s"}. Edits don't change questionnaires already started.</>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!readOnly && (
            <div className="inline-flex rounded-md border p-0.5">
              {[{ id: "edit", label: "Edit", icon: Pencil }, { id: "preview", label: "Preview", icon: Eye }].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-[5px] transition-colors ${
                    view === id ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          )}
          {form && (
            <Button variant="outline" size="sm" disabled={busy || dirty} title={dirty ? "Save or discard your changes first" : undefined}
              onClick={() => { setDupName(""); setDupOpen(true); }}>
              <Copy /> Duplicate
            </Button>
          )}
          {form && !archived && (
            <Button variant="outline" size="sm" disabled={busy || dirty} title={dirty ? "Save or discard your changes first" : undefined} onClick={onArchive}>
              <Archive /> Archive
            </Button>
          )}
          {archived && (
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" disabled={busy} onClick={onRestore}>
              {busy ? <Loader2 className="animate-spin" /> : <ArchiveRestore />} Restore
            </Button>
          )}
        </div>
      </div>

      {archived && (
        <p className="text-sm text-muted-foreground border-l-2 border-orange-500 pl-3">
          Archived forms can't be edited. Restore it to make changes, or duplicate it to start a new form from it.
        </p>
      )}

      {/* BB-129 phase 2: who gets this form */}
      {form && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-semibold">Assigned to</p>
                <p className="text-xs text-muted-foreground">
                  {archived
                    ? "Archived forms are skipped. These assignments apply again once it's restored."
                    : "Most specific wins: shift → employee → department → everyone."}
                </p>
              </div>
              {!archived && (
                <Button variant="outline" size="sm" onClick={openAssign}><Plus /> Assign</Button>
              )}
            </div>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not assigned yet, so nobody gets this questionnaire.</p>
            ) : (
              <ul className="divide-y">
                {assignments.map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                    <AssignmentTarget a={a} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Remove assignment" onClick={() => setRemoveAssignment({ ...a, form: { id: form.id, name: form.name } })}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form-level errors */}
      {showErrors && validation.form.length > 0 && (
        <ul className="text-sm text-destructive space-y-0.5">
          {validation.form.map((m) => <li key={m}>• {m}</li>)}
        </ul>
      )}

      {view === "preview" || readOnly ? (
        <TaskReportFormPreview
          name={draft.name}
          description={draft.description}
          questions={draft.questions}
          note={readOnly ? null : "Preview — this is how employees will see the form. Answers here aren't saved."}
        />
      ) : (
        <>
          {/* Name + description */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="form-name" className="text-xs">Form name</Label>
                  <Counter value={draft.name} max={L.name} />
                </div>
                <Input
                  id="form-name"
                  value={draft.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. End-of-shift checklist"
                  aria-invalid={showErrors && (!draft.name.trim() || draft.name.trim().length > L.name)}
                  className={showErrors && (!draft.name.trim() || draft.name.trim().length > L.name) ? "border-destructive" : ""}
                />
                <p className="text-[11px] text-muted-foreground">Must be different from your other active forms.</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="form-desc" className="text-xs">Description (optional)</Label>
                  <Counter value={draft.description} max={L.description} />
                </div>
                <Textarea
                  id="form-desc"
                  value={draft.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Shown to employees above the questions"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          {draft.questions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No questions yet. Add the first one below.</p>
          )}

          {draft.questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={idx}
              total={draft.questions.length}
              errors={qErrors[q.id]}
              canDuplicate={!atMax}
              onPatch={(patch) => patchQ(q.id, patch)}
              onType={(type) => changeType(q, type)}
              onMove={(dir) => moveQ(idx, dir)}
              onDuplicate={() => duplicateQ(idx)}
              onRemove={() => removeQ(q.id)}
            />
          ))}

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={atMax}><Plus /> Add question</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {QUESTION_TYPES.map((t) => (
                  <DropdownMenuItem key={t.type} onSelect={() => addQ(t.type)}>{t.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-xs text-muted-foreground">
              {draft.questions.length}/{L.maxQuestions} questions
            </span>
          </div>
        </>
      )}

      {/* Save bar */}
      {!readOnly && (dirty || isNew) && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{isNew ? "This form isn't saved yet." : "You have unsaved changes."}</p>
            <div className="flex gap-2">
              {!isNew && <Button variant="outline" onClick={discard} disabled={saving}>Discard</Button>}
              <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} {isNew ? "Create form" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <DuplicateFormDialog
          form={dupOpen ? form : null}
          name={dupName}
          setName={setDupName}
          busy={busy}
          onClose={() => setDupOpen(false)}
          onConfirm={onDuplicate}
        />
      )}

      {form && !archived && (
        <AssignFormDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          fixedForm={{ id: form.id, name: form.name }}
          assignments={allAssignments}
          onAssigned={() => { setAssignOpen(false); refreshAssignments(); }}
        />
      )}
      <RemoveAssignmentDialog
        target={removeAssignment}
        busy={removingAssignment}
        onCancel={() => setRemoveAssignment(null)}
        onConfirm={onRemoveAssignment}
      />

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your changes to this form will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(FORMS_BASE)}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── One question ─────────────────────────────────────────────────────────────
function QuestionCard({ q, index, total, errors, canDuplicate, onPatch, onType, onMove, onDuplicate, onRemove }) {
  const choice = isChoiceType(q.type);
  const hasErr = Boolean(errors?.length);

  const setOption = (i, v) => onPatch({ options: q.options.map((o, j) => (j === i ? v : o)) });
  const addOption = () => onPatch({ options: [...q.options, `Option ${q.options.length + 1}`] });
  const removeOption = (i) => onPatch({ options: q.options.filter((_, j) => j !== i) });

  return (
    <Card id={`q-${q.id}`} className={hasErr ? "border-destructive" : ""}>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground">Question {index + 1}</span>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canDuplicate} onClick={onDuplicate} aria-label="Duplicate question"><Copy /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label="Delete question"><Trash2 /></Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr_14rem] gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor={`q-label-${q.id}`} className="text-xs">Question</Label>
              <Counter value={q.label} max={L.label} />
            </div>
            <Input id={`q-label-${q.id}`} value={q.label} onChange={(e) => onPatch({ label: e.target.value })} placeholder="Question text" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={q.type} onValueChange={onType}>
              <SelectTrigger><SelectValue>{questionTypeLabel(q.type)}</SelectValue></SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((t) => <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor={`q-help-${q.id}`} className="text-xs">Help text (optional)</Label>
            <Counter value={q.helpText} max={L.helpText} />
          </div>
          <Input id={`q-help-${q.id}`} value={q.helpText} onChange={(e) => onPatch({ helpText: e.target.value })} placeholder="Extra guidance shown under the question" />
        </div>

        {choice && (
          <div className="space-y-2">
            <Label className="text-xs">Options</Label>
            {q.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                <Input value={opt} onChange={(e) => setOption(i, e.target.value)} maxLength={L.option + 50} className="h-8" />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeOption(i)} disabled={q.options.length <= 1} aria-label={`Remove option ${i + 1}`}>
                  <X />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700" onClick={addOption} disabled={q.options.length >= L.maxOptions}>
              <Plus /> Add option
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox id={`q-req-${q.id}`} checked={q.required} onCheckedChange={(c) => onPatch({ required: Boolean(c) })} />
          <Label htmlFor={`q-req-${q.id}`} className="text-sm font-normal cursor-pointer">Required</Label>
        </div>

        {hasErr && (
          <ul className="text-xs text-destructive space-y-0.5">
            {errors.map((m) => <li key={m}>• {m}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
