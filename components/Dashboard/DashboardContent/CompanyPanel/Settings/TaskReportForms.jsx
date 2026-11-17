"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/TaskReportForms.jsx
//
// BB-129 phase 1: list of custom clock-out forms (admin / superadmin only).
// Employees don't answer these yet; this page only builds and manages them.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Plus, RefreshCw, MoreHorizontal, Copy, Archive, ArchiveRestore, Trash2, Pencil, Eye, Loader2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listForms, duplicateForm, archiveForm, restoreForm, deleteForm, FORM_LIMITS,
} from "@/lib/taskReportFormsApi";
import TaskReportFormAssignments from "./TaskReportFormAssignments";

export const FORMS_BASE = "/dashboard/company/clock-out-forms";
const ADMIN_ROLES = ["admin", "superadmin"];

// The store has no role, so it's read from GET /api/account/profile (as Configurations does).
// Returns null while checking, then true / false. Non-admins are sent to the dashboard.
export function useFormsAccess() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [allowed, setAllowed] = useState(null);
  useEffect(() => {
    if (!token) { window.location.href = "/login"; return; }
    let cancelled = false;
    fetch(`${API}/api/account/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        const role = (j?.data?.user?.role || "").toLowerCase();
        const ok2 = ok && ADMIN_ROLES.includes(role);
        setAllowed(ok2);
        if (!ok2) window.location.href = "/dashboard";
      })
      .catch(() => { if (!cancelled) setAllowed(false); });
    return () => { cancelled = true; };
  }, [token, API]);
  return allowed;
}

export const formatWhen = (iso) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
      .format(new Date(iso));
  } catch { return "—"; }
};

const STATUS_FILTERS = [
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export default function TaskReportForms() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const allowed = useFormsAccess();

  // BB-129 phase 2: "forms" | "assignments" (?tab=assignments opens the second one)
  const [pageTab, setPageTab] = useState("forms");
  useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get("tab") === "assignments") setPageTab("assignments"); } catch {}
  }, []);
  const [status, setStatus] = useState("active");
  const [forms, setForms] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [dupTarget, setDupTarget] = useState(null); // form being duplicated
  const [dupName, setDupName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBlocked, setDeleteBlocked] = useState(null); // message when the form has answers

  const load = useCallback(async (s) => {
    setLoading(true); setError(null);
    try {
      const { data } = await listForms(API, token, s);
      setForms(data);
    } catch (e) {
      setError(e.message);
      if (e.status === 403) window.location.href = "/dashboard";
    }
    setLoading(false);
  }, [API, token]);

  useEffect(() => { if (allowed) load(status); }, [allowed, status, load]);

  const run = async (form, fn, success) => {
    setBusyId(form.id);
    try {
      await fn();
      toast.success(success);
      await load(status);
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally { setBusyId(null); }
  };

  const onArchive = (f) => run(f, () => archiveForm(API, token, f.id), `"${f.name}" archived`);
  const onRestore = async (f) => {
    setBusyId(f.id);
    try {
      await restoreForm(API, token, f.id);
      toast.success(`"${f.name}" restored`);
      await load(status);
    } catch (e) {
      if (e.code === "FORM_NAME_TAKEN") {
        toast.error(e.message, { description: "Rename the active form with that name, or duplicate this one instead." });
      } else toast.error(e.message);
    } finally { setBusyId(null); }
  };
  const onDuplicate = async () => {
    const f = dupTarget;
    if (!f) return;
    setBusyId(f.id);
    try {
      const copy = await duplicateForm(API, token, f.id, dupName);
      toast.success(`Created "${copy?.name || "copy"}"`);
      setDupTarget(null);
      if (copy?.id) router.push(`${FORMS_BASE}/${copy.id}`);
      else await load(status);
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(null); }
  };
  const onDelete = async () => {
    const f = deleteTarget;
    if (!f) return;
    setBusyId(f.id);
    try {
      await deleteForm(API, token, f.id);
      toast.success(`"${f.name}" deleted`);
      setDeleteTarget(null);
      await load(status);
    } catch (e) {
      // BB-129 phase 2: forms with answers can only be archived.
      if (e.code === "FORM_HAS_RESPONSES") setDeleteBlocked(e.message);
      else toast.error(e.message);
    } finally { setBusyId(null); }
  };
  const closeDelete = () => { setDeleteTarget(null); setDeleteBlocked(null); };
  const archiveInstead = async () => {
    const f = deleteTarget;
    const ok = await run(f, () => archiveForm(API, token, f.id), `"${f.name}" archived`);
    if (ok) closeDelete();
  };

  const header = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-orange-500" />
          Clock-out Forms
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Questionnaires employees answer after a shift, while Configurations → Trial Features → Clock-out
          documentation is set to Custom forms. Assign each form to a shift, employee, department or everyone.
        </p>
      </div>
      <div className="flex gap-2">
        {pageTab === "forms" && (
          <Button variant="outline" onClick={() => load(status)} disabled={loading || !allowed}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        )}
        <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
          <Link href={`${FORMS_BASE}/new`}><Plus /> New form</Link>
        </Button>
      </div>
    </div>
  );

  if (!allowed) {
    return (
      <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <Toaster position="top-center" />
      {header}

      <div className="flex gap-1 border-b">
        {[{ id: "forms", label: "Forms" }, { id: "assignments", label: "Assignments" }].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPageTab(t.id)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${
              pageTab === t.id
                ? "border-orange-500 text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {pageTab === "assignments" ? <TaskReportFormAssignments /> : (<>
      <div className="flex gap-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(s.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              status === s.id
                ? "border-orange-500 text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {forms === null && loading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => load(status)}>Try again</Button>
            </div>
          ) : !forms?.length ? (
            <div className="py-12 text-center space-y-1">
              <p className="font-medium">
                {status === "archived" ? "No archived forms." : "No forms yet."}
              </p>
              {status !== "archived" && (
                <p className="text-sm text-muted-foreground">Create one with <span className="font-medium">New form</span>.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Questions</TableHead>
                  <TableHead className="hidden md:table-cell">Last updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((f) => {
                  const archived = f.status === "archived";
                  const busy = busyId === f.id;
                  const who = f.updatedBy?.name || f.createdBy?.name;
                  return (
                    <TableRow key={f.id} className="cursor-pointer" onClick={() => router.push(`${FORMS_BASE}/${f.id}`)}>
                      <TableCell>
                        <p className="font-medium">{f.name}</p>
                        {f.description && <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">{f.description}</p>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {f.questionCount ?? 0}
                        <span className="text-muted-foreground"> · {f.requiredCount ?? 0} required</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {formatWhen(f.updatedAt)}
                        {who && <p className="text-xs text-muted-foreground">by {who}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={archived ? "secondary" : "outline"}>{archived ? "Archived" : "Active"}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={busy} aria-label={`Actions for ${f.name}`}>
                              {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => router.push(`${FORMS_BASE}/${f.id}`)}>
                              {archived ? <><Eye className="h-4 w-4" /> View</> : <><Pencil className="h-4 w-4" /> Edit</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setDupName(""); setDupTarget(f); }}>
                              <Copy className="h-4 w-4" /> Duplicate
                            </DropdownMenuItem>
                            {archived ? (
                              <DropdownMenuItem onSelect={() => onRestore(f)}>
                                <ArchiveRestore className="h-4 w-4" /> Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => onArchive(f)}>
                                <Archive className="h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteTarget(f)}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      </>)}

      <DuplicateFormDialog
        form={dupTarget}
        name={dupName}
        setName={setDupName}
        busy={Boolean(dupTarget) && busyId === dupTarget?.id}
        onClose={() => setDupTarget(null)}
        onConfirm={onDuplicate}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) closeDelete(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteBlocked ? `"${deleteTarget?.name}" can't be deleted` : `Delete "${deleteTarget?.name}"?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocked
                ? <>{deleteBlocked} Archive it instead: employees stop getting it, and its answers stay on Employee Report.</>
                : "This removes the form, its questions and its assignments for good. To keep it out of the way but recoverable, archive it instead."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteBlocked ? (
              deleteTarget?.status !== "archived" && (
                <AlertDialogAction onClick={(e) => { e.preventDefault(); archiveInstead(); }} disabled={busyId === deleteTarget?.id}>
                  Archive
                </AlertDialogAction>
              )
            ) : (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => { e.preventDefault(); onDelete(); }}
                disabled={busyId === deleteTarget?.id}
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Shared with the editor. Leaving the name blank lets the server name it "Copy of X".
export function DuplicateFormDialog({ form, name, setName, busy, onClose, onConfirm }) {
  return (
    <Dialog open={Boolean(form)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate "{form?.name}"</DialogTitle>
          <DialogDescription>The copy is an active form you can edit. Leave the name blank to call it "Copy of {form?.name}".</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="dup-name" className="text-xs">Name (optional)</Label>
          <Input
            id="dup-name"
            value={name}
            maxLength={FORM_LIMITS.name}
            placeholder={`Copy of ${form?.name || ""}`}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) onConfirm(); }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
