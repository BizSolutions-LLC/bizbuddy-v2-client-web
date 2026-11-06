// components/system-admin/bbuddy/StaffTab.jsx
//
// BB-110: support staff who sign in through B. Buddy — add/edit (name, PIN,
// their one company), suspend/reactivate, remove. Suspend is temporary; Remove is
// permanent (archived server-side, code can't be reused, audit trail kept).
// Suspended or removed staff are signed out on their next request.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Pause, Play, Trash2, Eye, EyeOff, Wand2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bbuddyFetch, formatDateTime } from "./api";

const PIN_RE = /^\d{6,8}$/;
const CODE_RE = /^[A-Z0-9-]{2,20}$/;

// Each staff member has at most one company; Select can't use "" as a value
const NO_COMPANY = "none";

const EMPTY_FORM = { code: "", name: "", pin: "", companyId: NO_COMPANY };

// `company` is the current shape; `companies` (0 or 1 entries) is the old one
const companyOf = (agent) => agent?.company || agent?.companies?.[0] || null;

const onlyDigits = (v) => v.replace(/\D/g, "").slice(0, 8);

// Random 6-digit PIN from the browser's secure RNG; skips trivially guessable ones
const WEAK_PINS = new Set(["123456", "654321", "012345", "543210"]);
function generatePin() {
  let pin;
  do {
    pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  } while (/^(\d)\1+$/.test(pin) || WEAK_PINS.has(pin));
  return pin;
}

// Too many wrong PINs; resetting the PIN clears the lock server-side
const isPinLocked = (agent) => Boolean(agent.pinLockedUntil && new Date(agent.pinLockedUntil) > new Date());

function StatusBadge({ agent }) {
  if (agent.archivedAt) return <Badge variant="outline" className="text-muted-foreground">Removed</Badge>;
  if (!agent.active) return <Badge variant="outline" className="text-yellow-700 border-yellow-300">Suspended</Badge>;
  if (isPinLocked(agent)) {
    return (
      <div className="space-y-0.5">
        <Badge variant="outline" className="text-red-600 border-red-200">Locked</Badge>
        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
          Until {formatDateTime(agent.pinLockedUntil)} · Reset PIN to unlock
        </p>
      </div>
    );
  }
  return <Badge variant="secondary">Active</Badge>;
}

function AccessChip({ agent }) {
  const company = companyOf(agent);
  if (company) {
    return (
      <Badge variant="outline" className="font-normal">
        {company.name}
      </Badge>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge variant="outline" className="font-normal text-muted-foreground cursor-default">
            Not assigned
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>Can&apos;t sign in as B. Buddy until a company is assigned.</TooltipContent>
    </Tooltip>
  );
}

export default function StaffTab({ agents, accounts, loading, error, onChanged }) {
  const [showRemoved, setShowRemoved] = useState(false);
  // dialog: { mode: "add" | "edit" | "status" | "remove", agent? }
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Edit: moving / unassigning someone who already has a company needs a confirm step
  const [confirmMove, setConfirmMove] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = showRemoved ? agents : agents.filter((a) => !a.archivedAt);
  const activeCount = agents.filter((a) => a.active && !a.archivedAt).length;

  const open = (mode, agent = null) => {
    setForm(
      agent
        ? {
            code: agent.code,
            name: agent.name,
            pin: "",
            companyId: companyOf(agent)?.id || NO_COMPANY,
          }
        : EMPTY_FORM
    );
    setConfirmMove(false);
    setFormError("");
    setShowPin(false);
    setPinCopied(false);
    setDialog({ mode, agent });
  };

  const close = () => {
    if (!saving) setDialog(null);
  };

  const companyName = (id) => accounts.find((c) => c.companyId === id)?.companyName || "another company";

  // Builds the request for the open dialog, or returns an error string
  const buildRequest = () => {
    const { mode, agent } = dialog;

    if (mode === "status") {
      return { path: `/agents/${agent.id}`, method: "PUT", body: { active: !agent.active } };
    }
    if (mode === "remove") {
      return { path: `/agents/${agent.id}`, method: "DELETE" };
    }

    const name = form.name.trim();
    if (!name) return "Name is required.";
    const companyId = form.companyId === NO_COMPANY ? null : form.companyId;

    if (mode === "add") {
      const code = form.code.trim().toUpperCase();
      if (!CODE_RE.test(code)) return "Staff code must be 2–20 letters, digits or dashes.";
      if (!PIN_RE.test(form.pin)) return "PIN must be 6–8 digits.";
      return {
        path: "/agents",
        method: "POST",
        body: {
          code,
          name,
          pin: form.pin,
          ...(companyId ? { companyId } : {}),
        },
      };
    }

    // Edit: only send what changed
    if (form.pin && !PIN_RE.test(form.pin)) return "PIN must be 6–8 digits.";
    const body = {};
    if (name !== agent.name) body.name = name;
    if (form.pin) body.pin = form.pin;
    if (companyId !== (companyOf(agent)?.id || null)) body.companyId = companyId;
    if (Object.keys(body).length === 0) return "Nothing to save.";
    return { path: `/agents/${agent.id}`, method: "PUT", body };
  };

  const successMessage = () => {
    const { mode, agent } = dialog;
    if (mode === "add") return "Staff member added.";
    if (mode === "edit") return "Staff member updated.";
    if (mode === "remove") return `${agent.name} removed.`;
    return agent.active ? `${agent.name} suspended.` : `${agent.name} reactivated.`;
  };

  const submit = async (e) => {
    e?.preventDefault();
    const request = buildRequest();
    if (typeof request === "string") return setFormError(request);

    // Moving away from an existing company signs them out of it — confirm first
    if (dialog.mode === "edit" && companyOf(dialog.agent) && "companyId" in (request.body || {}) && !confirmMove) {
      setFormError("");
      return setConfirmMove(true);
    }

    setSaving(true);
    setFormError("");
    try {
      await bbuddyFetch(request.path, { method: request.method, body: request.body });
      toast.success(successMessage());
      setDialog(null);
      onChanged();
    } catch (err) {
      // Server messages: 400 validation, 404 not found, 409 code taken / already removed
      setFormError(err.message);
      setConfirmMove(false);
    } finally {
      setSaving(false);
    }
  };

  const mode = dialog?.mode;
  const agent = dialog?.agent;
  const isForm = (mode === "add" || mode === "edit") && !confirmMove;

  // Confirm-step copy for moving / unassigning
  const fromCompany = companyOf(agent)?.name;
  const toCompanyId = form.companyId === NO_COMPANY ? null : form.companyId;
  const moveTitle = toCompanyId
    ? `Move ${agent?.name} from ${fromCompany} to ${companyName(toCompanyId)}?`
    : `Unassign ${agent?.name} from ${fromCompany}?`;
  const moveDescription = toCompanyId
    ? `They'll be signed out of ${fromCompany}.`
    : `They'll be signed out of ${fromCompany} and can't sign in as B. Buddy until a company is assigned.`;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            Support staff <span className="text-muted-foreground font-normal">· {activeCount} active</span>
          </CardTitle>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={showRemoved} onCheckedChange={(v) => setShowRemoved(v === true)} />
              Show removed
            </label>
            <Button size="sm" onClick={() => open("add")}>
              <Plus /> Add staff
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {loading ? "Loading…" : "No support staff yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((a) => (
                    <TableRow key={a.id} className={a.archivedAt || !a.active ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-sm">{a.code}</TableCell>
                      <TableCell className="text-sm font-medium">{a.name}</TableCell>
                      <TableCell className="max-w-xs">
                        <AccessChip agent={a} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge agent={a} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(a.lastUsedAt)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {a.archivedAt ? (
                          <span className="text-xs text-muted-foreground">Removed {formatDateTime(a.archivedAt)}</span>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => open("edit", a)}>
                              <Pencil /> {isPinLocked(a) ? "Edit / Reset PIN" : "Edit"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => open("status", a)}>
                              {a.active ? <Pause /> : <Play />} {a.active ? "Suspend" : "Reactivate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => open("remove", a)}
                            >
                              <Trash2 /> Remove
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && close()}>
        <DialogContent className={isForm ? "sm:max-w-lg" : "sm:max-w-md"}>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {confirmMove && moveTitle}
                {mode === "add" && "Add support staff"}
                {mode === "edit" && !confirmMove && `Edit ${agent?.name}`}
                {mode === "status" && (agent?.active ? `Suspend ${agent?.name}?` : `Reactivate ${agent?.name}?`)}
                {mode === "remove" && `Remove ${agent?.name}?`}
              </DialogTitle>
              <DialogDescription>
                {confirmMove && moveDescription}
                {mode === "add" && "They'll sign in to their company's B. Buddy account with this staff code and PIN."}
                {mode === "edit" && !confirmMove && "Staff code can't be changed. Leave Reset PIN empty to keep the current PIN."}
                {mode === "status" &&
                  (agent?.active
                    ? "This is temporary. They'll be signed out and can't sign in until reactivated."
                    : "They'll be able to sign in again with their existing PIN.")}
                {mode === "remove" &&
                  `They'll be signed out and can't sign in again. Their past activity stays in the audit log. Code ${agent?.code} can't be reused.`}
              </DialogDescription>
            </DialogHeader>

            {isForm && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-code">Code</Label>
                    <Input
                      id="agent-code"
                      value={form.code}
                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      disabled={mode === "edit"}
                      autoComplete="off"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-name">Name</Label>
                    <Input
                      id="agent-name"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="agent-pin">{mode === "edit" ? "Reset PIN (optional)" : "PIN"}</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="agent-pin"
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        value={form.pin}
                        onChange={(e) => setForm((p) => ({ ...p, pin: onlyDigits(e.target.value) }))}
                        autoComplete="new-password"
                        className="pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                        aria-label={showPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setForm((p) => ({ ...p, pin: generatePin() }));
                        setShowPin(true);
                        setPinCopied(false);
                      }}
                    >
                      <Wand2 /> Generate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!form.pin}
                      aria-label="Copy PIN"
                      title="Copy PIN"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(form.pin);
                          setPinCopied(true);
                          setTimeout(() => setPinCopied(false), 2000);
                        } catch (error) {
                          console.error("Copy PIN error:", error);
                        }
                      }}
                    >
                      {pinCopied ? <Check /> : <Copy />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    6–8 digits. Copy it before saving and share it with them directly — it can&apos;t be viewed later.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Select value={form.companyId} onValueChange={(v) => setForm((p) => ({ ...p, companyId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="No company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_COMPANY}>No company</SelectItem>
                      {/* Retired companies can't be picked; keep the current one so the field isn't blank */}
                      {accounts
                        .filter((c) => !c.isRetired || c.companyId === form.companyId)
                        .map((c) => (
                          <SelectItem key={c.companyId} value={c.companyId}>
                            {c.companyName || c.companyId}
                            {!c.hasBBuddy && <span className="ml-2 text-xs text-muted-foreground">B. Buddy not set up yet</span>}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Each staff member can access one company only.</p>
                </div>
              </>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={confirmMove ? () => setConfirmMove(false) : close}
                disabled={saving}
              >
                {confirmMove ? "Back" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                variant={mode === "remove" || (mode === "status" && agent?.active) ? "destructive" : "default"}
              >
                {saving
                  ? "Saving…"
                  : confirmMove
                    ? toCompanyId
                      ? "Move"
                      : "Unassign"
                    : mode === "add"
                    ? "Add staff"
                    : mode === "edit"
                      ? "Save"
                      : mode === "remove"
                        ? "Remove"
                        : agent?.active
                          ? "Suspend"
                          : "Reactivate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
