// app/system-admin/account/page.jsx
//
// BB-110: "My account" — every system admin can change their password and
// generate new recovery codes (needs the current authenticator code).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import RecoveryCodes from "@/components/system-admin/RecoveryCodes";
import { useSystemAdmin } from "@/components/system-admin/SystemAdminContext";
import {
  systemAdminFetch,
  clearSystemAdminToken,
  SYSTEM_ADMIN_LOGIN,
  LOGIN_NOTICE_KEY,
  RECOVERY_LEFT_KEY,
} from "@/lib/systemAdminFetch";

const MIN_PASSWORD = 12;

export default function SystemAdminAccountPage() {
  const { admin } = useSystemAdmin();

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">My account</h1>
        <p className="text-sm text-neutral-600 flex flex-wrap items-center gap-2">
          {admin?.name} · @{admin?.username}
          <Badge variant="secondary">{admin?.isOwner ? "Owner" : "Admin"}</Badge>
          <Badge variant="outline">2FA {admin?.twoFactorEnabled ? "on" : "not set up"}</Badge>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <ChangePasswordCard />
        <RecoveryCodesCard username={admin?.username} />
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setField = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < MIN_PASSWORD) return setError(`New password must be at least ${MIN_PASSWORD} characters.`);
    if (form.newPassword !== form.confirmPassword) return setError("New passwords don't match.");

    setSaving(true);
    setError("");
    try {
      await systemAdminFetch("/api/system-admin/auth/password", {
        method: "PUT",
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      // Every session ends server-side — sign in again
      clearSystemAdminToken();
      try {
        sessionStorage.setItem(LOGIN_NOTICE_KEY, "Password changed. Please sign in again.");
      } catch {}
      router.push(SYSTEM_ADMIN_LOGIN);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Change password
        </CardTitle>
        <CardDescription>You&apos;ll be signed out everywhere and asked to sign in again.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={form.currentPassword}
              onChange={setField}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={form.newPassword}
              onChange={setField}
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={setField}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RecoveryCodesCard({ username }) {
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await systemAdminFetch("/api/system-admin/auth/2fa/recovery-codes", {
        method: "POST",
        body: { code },
      });
      setCodes(data.recoveryCodes || []);
      try {
        sessionStorage.removeItem(RECOVERY_LEFT_KEY);
      } catch {}
    } catch (err) {
      setCode("");
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const done = () => {
    setCodes(null);
    setCode("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LifeBuoy className="w-4 h-4" /> Recovery codes
        </CardTitle>
        {!codes && (
          <CardDescription>
            Generate 10 new codes for signing in without your phone. Your old recovery codes will stop working.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {codes ? (
          <RecoveryCodes codes={codes} username={username} continueLabel="Done" onContinue={done} />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="regen-code">Current authenticator code</Label>
              <Input
                id="regen-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="font-mono tracking-[0.3em]"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={saving || code.length !== 6}>
              {saving ? "Generating…" : "Generate new recovery codes"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
