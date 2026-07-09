"use client";

import { Trash2, Loader2, Building, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(employee) {
  const first = employee?.profile?.firstName?.[0] ?? "";
  const last  = employee?.profile?.lastName?.[0]  ?? "";
  return (first + last).toUpperCase() || "?";
}

function fullName(employee) {
  const first = employee?.profile?.firstName ?? "";
  const last  = employee?.profile?.lastName  ?? "";
  return `${first} ${last}`.trim() || employee?.email || "Unknown";
}

const ROLE_STYLES = {
  admin:      "bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-400",
  supervisor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  employee:   "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400",
};

// ── Component ──────────────────────────────────────────────────────────────────

export function DeleteEmployeeModal({
  open,
  onOpenChange,
  employee,
  deleteConfirmText,
  setDeleteConfirmText,
  deleteLoading,
  onConfirm,
}) {
  if (!employee) return null;

  const name     = fullName(employee);
  const deptName = employee.department?.name ?? null;
  const role     = employee.role ?? "employee";
  const confirmed = deleteConfirmText.trim() === name;
  const typed     = deleteConfirmText.length > 0;

  const inputBorderClass = typed
    ? confirmed
      ? "border-green-500 focus-visible:ring-green-500"
      : "border-red-400  focus-visible:ring-red-400"
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md dark:border-white/10">
        <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />

        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400 flex-shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            Delete employee
          </DialogTitle>
          <DialogDescription>
            This is permanent and cannot be undone. The employee will lose all
            access immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Employee identity card */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/40">
            <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-red-700 dark:text-red-300 select-none">
              {initials(employee)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate mb-1.5">{employee.email}</p>
              <div className="flex gap-1.5 flex-wrap">
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_STYLES[role] ?? ROLE_STYLES.employee}`}>
                  <User className="h-2.5 w-2.5 mr-1" />
                  {role}
                </span>
                {deptName && (
                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                    <Building className="h-2.5 w-2.5 mr-1" />
                    {deptName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Consequence list */}
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 space-y-2">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
              What gets deleted
            </p>
            {[
              "Account & login access",
              "Employment & profile data",
              "Schedule assignments",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-xs text-red-800 dark:text-red-300">{item}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-red-200 dark:border-red-800 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              <span className="text-xs text-orange-700 dark:text-orange-400">
                Time logs are retained for payroll records
              </span>
            </div>
          </div>

          {/* Confirmation input */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">
              Type{" "}
              <code className="font-mono font-semibold text-foreground bg-muted px-1 py-0.5 rounded text-xs">
                {name}
              </code>{" "}
              to confirm
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`Type "${name}"…`}
              className={`transition-colors ${inputBorderClass}`}
              autoComplete="off"
              spellCheck={false}
            />
            {typed && !confirmed && (
              <p className="text-xs text-red-500">Name doesn&apos;t match — check for typos.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteLoading || !confirmed}
            onClick={onConfirm}
            className="bg-red-500 hover:bg-red-600 disabled:opacity-40"
          >
            {deleteLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete employee
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
