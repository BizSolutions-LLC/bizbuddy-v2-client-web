// components/system-admin/emails/SendTestDialog.jsx
//
// BB-140: send a test of any email template — POST /api/system-admin/emails/test
// { template, to }. The server sends the REAL template with sample data (Jane Doe,
// BizBuddy Demo Co., a fake password / code / link); the subject starts with [TEST].
// Templates come from GET /emails/templates (never hard-coded).
// Errors: 400 unknown template / bad address, 429 more than 30 tests an hour,
// 502 the mail server refused (that one is also logged as a failed test).
// The address is pre-filled with the admin's username when it's an email (system admins
// have no email field), otherwise with the last address used here (this browser only).

"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { useSystemAdmin } from "@/components/system-admin/SystemAdminContext";

const LAST_TO_KEY = "system-admin-email-test-to"; // per-browser convenience only

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

function readLastTo() {
  try { return localStorage.getItem(LAST_TO_KEY) || ""; } catch { return ""; }
}
function saveLastTo(value) {
  try { localStorage.setItem(LAST_TO_KEY, value); } catch {}
}

export default function SendTestDialog({ open, onOpenChange, templates, templatesError, onSent }) {
  const { admin } = useSystemAdmin();
  const [template, setTemplate] = useState("");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  // Fresh form each time it opens
  useEffect(() => {
    if (!open) return;
    setError("");
    setResult("");
    setTo((current) => current || (looksLikeEmail(admin?.username) ? admin.username : readLastTo()));
  }, [open, admin]);

  const selected = (templates || []).find((t) => t.key === template);

  const send = async (e) => {
    e.preventDefault();
    setError("");
    setResult("");
    if (!template) { setError("Pick a template."); return; }
    if (!looksLikeEmail(to)) { setError("Enter a valid email address."); return; }
    setSending(true);
    try {
      const json = await systemAdminFetch("/api/system-admin/emails/test", {
        method: "POST",
        body: { template, to: to.trim() },
      });
      saveLastTo(to.trim());
      const message = json.message || `Test sent to ${to.trim()}.`;
      setResult(message);
      toast.success(message);
      onSent?.();
    } catch (err) {
      setError(err.message);
      // A mail-server refusal is still logged (as a failed test), so the list changes too
      if (err.status === 502) onSent?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={send} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
            <DialogDescription>
              Sends the real template with sample data (Jane Doe, BizBuddy Demo Co., a fake password, code or link).
              The subject starts with [TEST] and it shows in the list as a test.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={template} onValueChange={(v) => { setTemplate(v); setError(""); }} disabled={sending}>
              <SelectTrigger>
                <SelectValue placeholder={templates ? "Choose a template" : templatesError ? "Templates unavailable" : "Loading templates…"} />
              </SelectTrigger>
              <SelectContent>
                {(templates || []).map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label || t.key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Sent from <span className="font-medium">{selected.from}</span>
                {selected.usedBy && <> · used by {selected.usedBy}</>}
              </p>
            )}
            {templatesError && <p className="text-xs text-red-600">{templatesError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-test-to">Send to</Label>
            <Input
              id="email-test-to"
              type="email"
              autoComplete="email"
              value={to}
              onChange={(e) => { setTo(e.target.value); setError(""); }}
              disabled={sending}
              placeholder="you@example.com"
            />
          </div>

          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {result && <p className="text-sm text-green-700 dark:text-green-400">{result}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Close
            </Button>
            <Button type="submit" disabled={sending || !templates?.length}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />} Send test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
