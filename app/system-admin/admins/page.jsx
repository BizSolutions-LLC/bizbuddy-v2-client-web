// app/system-admin/admins/page.jsx
//
// BB-110: "System Admins" — owners only. Add admins, edit name / owner role,
// deactivate / reactivate, reset 2FA (lost phone), reset password (also unlocks).
// The server blocks self-lockout cases (deactivating yourself, dropping your own
// owner role, resetting your own 2FA/password here, removing the last owner).

"use client";

import { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Plus, Pencil, Power, Smartphone, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSystemAdmin } from "@/components/system-admin/SystemAdminContext";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { formatDateTime } from "@/components/system-admin/bbuddy/api";

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
const MIN_PASSWORD = 12;

const EMPTY_FORM = { username: "", name: "", password: "", isOwner: false };

function StatusBadge({ admin }) {
  if (admin.lockedUntil) return <Badge variant="outline" className="text-red-600 border-red-200">Locked</Badge>;
  if (!admin.active) return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
  return <Badge variant="secondary">Active</Badge>;
}

export default function SystemAdminsPage() {
  const { admin: me } = useSystemAdmin();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // dialog: { mode: "add" | "edit" | "status" | "reset-2fa" | "reset-password", target? }
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const json = await systemAdminFetch("/api/system-admin/admins");
      setAdmins(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me?.isOwner) load();
  }, [me?.isOwner, load]);

  if (!me?.isOwner) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">System Admins</h1>
        <p className="text-sm text-neutral-600">Only an owner can manage system admins.</p>
      </div>
    );
  }

  const open = (mode, target = null) => {
    setForm(target ? { username: target.username, name: target.name, password: "", isOwner: target.isOwner } : EMPTY_FORM);
    setFormError("");
    setDialog({ mode, target });
  };

  const close = () => {
    if (!saving) setDialog(null);
  };

  // Builds the request for the open dialog, or returns an error string
  const buildRequest = () => {
    const { mode, target } = dialog;

    if (mode === "add") {
      const username = form.username.trim().toLowerCase();
      if (!USERNAME_RE.test(username)) return "Username must be 3–40 lowercase letters, digits, dots, dashes or underscores.";
      if (!form.name.trim()) return "Name is required.";
      if (form.password.length < MIN_PASSWORD) return `Temporary password must be at least ${MIN_PASSWORD} characters.`;
      return {
        path: "/api/system-admin/admins",
        method: "POST",
        body: { username, name: form.name.trim(), password: form.password, isOwner: form.isOwner },
      };
    }
    if (mode === "edit") {
      const name = form.name.trim();
      if (!name) return "Name can't be empty.";
      const body = {};
      if (name !== target.name) body.name = name;
      if (form.isOwner !== target.isOwner) body.isOwner = form.isOwner;
      if (Object.keys(body).length === 0) return "Nothing to save.";
      return { path: `/api/system-admin/admins/${target.id}`, method: "PUT", body };
    }
    if (mode === "status") {
      return { path: `/api/system-admin/admins/${target.id}`, method: "PUT", body: { active: !target.active } };
    }
    if (mode === "reset-2fa") {
      return { path: `/api/system-admin/admins/${target.id}/reset-2fa`, method: "POST" };
    }
    // reset-password
    if (form.password.length < MIN_PASSWORD) return `New password must be at least ${MIN_PASSWORD} characters.`;
    return {
      path: `/api/system-admin/admins/${target.id}/reset-password`,
      method: "POST",
      body: { password: form.password },
    };
  };

  const successMessage = () => {
    const { mode, target } = dialog;
    if (mode === "add") return "System admin added.";
    if (mode === "edit") return "System admin updated.";
    if (mode === "reset-2fa") return `2FA reset for ${target.name}.`;
    if (mode === "reset-password") return `Password reset for ${target.name}.`;
    return target.active ? `${target.name} deactivated.` : `${target.name} reactivated.`;
  };

  const submit = async (e) => {
    e?.preventDefault();
    const request = buildRequest();
    if (typeof request === "string") return setFormError(request);

    setSaving(true);
    setFormError("");
    try {
      await systemAdminFetch(request.path, { method: request.method, body: request.body });
      toast.success(successMessage());
      setDialog(null);
      load();
    } catch (err) {
      // 400 = blocked self-lockout / validation, 409 = username taken, 404 = not found
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const mode = dialog?.mode;
  const target = dialog?.target;
  const isDestructive = (mode === "status" && target?.active) || mode === "reset-2fa";

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8">
      <Toaster position="top-right" richColors />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">System Admins</h1>
        <p className="text-sm text-neutral-600">Who can sign in to this dashboard</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            Admins <span className="text-muted-foreground font-normal">· {admins.filter((a) => a.active).length} active</span>
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          <Button size="sm" onClick={() => open("add")}>
            <Plus /> Add admin
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {loading ? "Loading…" : "No system admins."}
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((a) => {
                    const isMe = a.id === me.id;
                    return (
                      <TableRow key={a.id} className={a.active ? "" : "opacity-60"}>
                        <TableCell className="text-sm font-medium">
                          {a.name}
                          {isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{a.username}</TableCell>
                        <TableCell className="text-sm">{a.isOwner ? "Owner" : "Admin"}</TableCell>
                        <TableCell className="text-sm">
                          {a.twoFactorEnabled ? "On" : <span className="text-muted-foreground">Not set up</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge admin={a} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(a.lastLoginAt)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" onClick={() => open("edit", a)}>
                            <Pencil /> Edit
                          </Button>
                          {/* Your own 2FA / password / status are managed from My account or by another owner */}
                          {!isMe && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => open("reset-password", a)}>
                                <KeyRound /> {a.lockedUntil ? "Reset password & unlock" : "Reset password"}
                              </Button>
                              {a.twoFactorEnabled && (
                                <Button variant="ghost" size="sm" onClick={() => open("reset-2fa", a)}>
                                  <Smartphone /> Reset 2FA
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className={a.active ? "text-red-600 hover:text-red-700" : ""}
                                onClick={() => open("status", a)}
                              >
                                <Power /> {a.active ? "Deactivate" : "Reactivate"}
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {mode === "add" && "Add system admin"}
                {mode === "edit" && `Edit ${target?.name}`}
                {mode === "status" && (target?.active ? `Deactivate ${target?.name}?` : `Reactivate ${target?.name}?`)}
                {mode === "reset-2fa" && `Reset 2FA for ${target?.name}?`}
                {mode === "reset-password" && `Reset password for ${target?.name}`}
              </DialogTitle>
              <DialogDescription>
                {mode === "add" && "They'll set up their authenticator app at first sign-in."}
                {mode === "edit" && `Username ${target?.username} can't be changed.`}
                {mode === "status" &&
                  (target?.active
                    ? "They'll be signed out immediately."
                    : "They'll be able to sign in again with their existing password and authenticator.")}
                {mode === "reset-2fa" && "They'll be signed out and must scan a new QR code at next sign-in."}
                {mode === "reset-password" &&
                  "Set a temporary password and share it with them directly. This also unlocks the account."}
              </DialogDescription>
            </DialogHeader>

            {mode === "add" && (
              <div className="space-y-1.5">
                <Label htmlFor="admin-username">Username</Label>
                <Input
                  id="admin-username"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase() }))}
                  autoComplete="off"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">3–40 lowercase letters, digits, dots, dashes or underscores.</p>
              </div>
            )}

            {(mode === "add" || mode === "edit") && (
              <div className="space-y-1.5">
                <Label htmlFor="admin-name">Name</Label>
                <Input
                  id="admin-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  autoComplete="off"
                />
              </div>
            )}

            {(mode === "add" || mode === "reset-password") && (
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">{mode === "add" ? "Temporary password" : "New temporary password"}</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
              </div>
            )}

            {(mode === "add" || mode === "edit") && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.isOwner}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, isOwner: v === true }))}
                />
                Owner (can manage system admins)
              </label>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} variant={isDestructive ? "destructive" : "default"}>
                {saving
                  ? "Saving…"
                  : mode === "add"
                    ? "Add admin"
                    : mode === "edit"
                      ? "Save"
                      : mode === "reset-2fa"
                        ? "Reset 2FA"
                        : mode === "reset-password"
                          ? "Reset password"
                          : target?.active
                            ? "Deactivate"
                            : "Reactivate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
