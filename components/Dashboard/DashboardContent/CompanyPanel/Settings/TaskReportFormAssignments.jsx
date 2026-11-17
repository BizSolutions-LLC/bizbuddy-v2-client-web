"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/TaskReportFormAssignments.jsx
//
// BB-129 phase 2: which custom form a punch gets. Most specific wins:
// shift → employee → department → everyone. No match → no questionnaire.
// One form per target (assigning again replaces it). Archived forms are skipped, but their
// assignments are kept for when the form is restored. The server owns all of this.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Loader2, Search, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listAssignments, putAssignment, deleteAssignment, listForms, loadAssignmentTargets,
  ASSIGNMENT_SCOPES, scopeLabel, scopeRank,
} from "@/lib/taskReportFormsApi";

const ASSIGN_ERROR_HINT = {
  FORM_ARCHIVED: "Restore the form first, then assign it.",
  TARGET_NOT_FOUND: "That department, employee or shift no longer exists.",
};

export function targetText(a) {
  if (a.scope === "all") return "Everyone";
  return a.target?.name || "Unknown";
}

// Small label used in the editor's "Assigned to" list and the table.
export function AssignmentTarget({ a }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="font-normal">{scopeLabel(a.scope)}</Badge>
        <span className={`text-sm ${a.target?.missing ? "line-through text-muted-foreground" : "font-medium"}`}>{targetText(a)}</span>
      </div>
      {a.target?.missing && (
        <p className="text-xs text-destructive mt-0.5">No longer exists. Remove this assignment.</p>
      )}
    </div>
  );
}

// ── Tab content on the Clock-out Forms page ──────────────────────────────────
export default function TaskReportFormAssignments() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [rows, setRows] = useState(null);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);       // null | { scope?, targetId?, formId? }
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [a, f] = await Promise.all([listAssignments(API, token), listForms(API, token, "active")]);
      setRows(a.data);
      setForms(f.data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [API, token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  const sorted = useMemo(
    () => [...(rows || [])].sort((a, b) => scopeRank(a.scope) - scopeRank(b.scope) || targetText(a).localeCompare(targetText(b))),
    [rows]
  );

  const onRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await deleteAssignment(API, token, removeTarget.id);
      toast.success("Assignment removed");
      setRemoveTarget(null);
      await load();
    } catch (e) { toast.error(e.message); }
    setRemoving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Which questionnaire a punch gets. The most specific match wins:
          <span className="text-foreground"> shift → employee → department → everyone</span>.
          No match means no questionnaire. Archived forms are skipped until restored.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setDialog({})} disabled={!forms.length && !loading}>
            <Plus /> Assign form
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows === null && loading ? (
            <div className="p-6 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : error ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={load}>Try again</Button>
            </div>
          ) : !sorted.length ? (
            <div className="py-12 text-center space-y-1">
              <p className="font-medium">No assignments yet.</p>
              <p className="text-sm text-muted-foreground">
                {forms.length ? "Until a form is assigned, nobody gets a questionnaire." : "Create a form first, then assign it here."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><AssignmentTarget a={a} /></TableCell>
                    <TableCell>
                      <p className="text-sm">{a.form?.name || "—"}</p>
                      {a.formArchived && <p className="text-xs text-muted-foreground">Archived, skipped until restored</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        {!a.target?.missing && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Change form"
                            onClick={() => setDialog({ scope: a.scope, targetId: a.target?.id || null, formId: a.form?.id })}>
                            <Pencil />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Remove assignment"
                          onClick={() => setRemoveTarget(a)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AssignFormDialog
        open={Boolean(dialog)}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        initial={dialog || {}}
        forms={forms}
        assignments={rows || []}
        onAssigned={() => { setDialog(null); load(); }}
      />

      <RemoveAssignmentDialog target={removeTarget} busy={removing} onCancel={() => setRemoveTarget(null)} onConfirm={onRemove} />
    </div>
  );
}

export function RemoveAssignmentDialog({ target, busy, onCancel, onConfirm }) {
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this assignment?</AlertDialogTitle>
          <AlertDialogDescription>
            {target && <>{scopeLabel(target.scope)} “{targetText(target)}” will no longer get {target.form?.name ? `“${target.form.name}”` : "this form"}. </>}
            The next matching rule applies instead. Questionnaires already started keep their form.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); onConfirm(); }} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Assign / replace dialog ──────────────────────────────────────────────────
// forms: active forms to choose from. fixedForm: { id, name } when opened from a form's editor.
// assignments: current rows (to say which form a target has now). initial: { scope, targetId, formId }.
export function AssignFormDialog({ open, onOpenChange, initial = {}, forms = [], fixedForm = null, assignments = [], onAssigned }) {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [scope, setScope] = useState("shift");
  const [targetId, setTargetId] = useState(null);
  const [formId, setFormId] = useState("");
  const [targets, setTargets] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setScope(initial.scope || "shift");
    setTargetId(initial.targetId || null);
    setFormId(fixedForm?.id || initial.formId || "");
    setSearch(""); setError(null);
    if (!targets) loadAssignmentTargets(API, token).then(setTargets).catch(() => setTargets({ department: [], employee: [], shift: [] }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = scope === "all" ? [] : (targets?.[scope] || []);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.sub || ""}`.toLowerCase().includes(q)) : options;
  }, [options, search]);

  // What this target has today (assigning again replaces it).
  const existing = assignments.find((a) => a.scope === scope && (scope === "all" || a.target?.id === targetId));
  const chosenForm = fixedForm || forms.find((f) => f.id === formId);
  const sameAsExisting = existing && existing.form?.id === chosenForm?.id;
  const ready = Boolean(chosenForm) && (scope === "all" || Boolean(targetId)) && !sameAsExisting;

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const row = await putAssignment(API, token, { scope, targetId, formId: chosenForm.id });
      toast.success(existing ? "Assignment replaced" : "Form assigned");
      onAssigned?.(row);
    } catch (e) {
      setError([e.message, ASSIGN_ERROR_HINT[e.code]].filter(Boolean).join(" "));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fixedForm ? `Assign “${fixedForm.name}”` : "Assign a form"}</DialogTitle>
          <DialogDescription>Pick who gets the questionnaire after clocking out. A target has one form; assigning again replaces it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Applies to</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup">
              {ASSIGNMENT_SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={scope === s.id}
                  onClick={() => { setScope(s.id); setTargetId(null); setSearch(""); setError(null); }}
                  className={`px-3 py-2 rounded-md border text-sm text-left transition-colors ${
                    scope === s.id ? "border-orange-500 font-medium" : "border-input text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{ASSIGNMENT_SCOPES.find((s) => s.id === scope)?.hint}</p>
          </div>

          {scope !== "all" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{scopeLabel(scope)}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${scopeLabel(scope).toLowerCase()}s`} className="pl-8 h-9" />
              </div>
              <div className="border rounded-md max-h-52 overflow-y-auto" role="listbox">
                {!targets ? (
                  <div className="p-2 space-y-1.5"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-full" /></div>
                ) : shown.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">{options.length ? "No matches." : `No ${scopeLabel(scope).toLowerCase()}s found.`}</p>
                ) : shown.map((o) => {
                  const selected = o.value === targetId;
                  const has = assignments.find((a) => a.scope === scope && a.target?.id === o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => { setTargetId(o.value); setError(null); }}
                      className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${selected ? "bg-accent" : "hover:bg-muted/50"}`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{o.label}</span>
                        {(o.sub || has) && (
                          <span className="block text-xs text-muted-foreground truncate">
                            {[o.sub, has ? `Has “${has.form?.name}”` : null].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      {selected && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!fixedForm && (
            <div className="space-y-1.5">
              <Label className="text-xs">Form</Label>
              <Select value={formId} onValueChange={(v) => { setFormId(v); setError(null); }}>
                <SelectTrigger><SelectValue placeholder="Choose a form" /></SelectTrigger>
                <SelectContent>
                  {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!forms.length && <p className="text-xs text-muted-foreground">No active forms. Create one first.</p>}
            </div>
          )}

          {existing && chosenForm && (
            <p className="text-xs text-muted-foreground">
              {sameAsExisting
                ? <>This already gets “{chosenForm.name}”.</>
                : <>This replaces “{existing.form?.name}”. Questionnaires already started keep their form.</>}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={submit} disabled={!ready || saving}>
            {saving && <Loader2 className="animate-spin" />} {existing && !sameAsExisting ? "Replace" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
