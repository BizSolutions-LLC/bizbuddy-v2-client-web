// components/system-admin/RecoveryCodes.jsx
//
// BB-110: "Save your recovery codes" — shown once after 2FA setup and after
// generating new codes. The admin must tick the checkbox before continuing.

"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export default function RecoveryCodes({ codes, username, onContinue, continueLabel = "Continue" }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = codes.join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy recovery codes error:", error);
    }
  };

  const handleDownload = () => {
    const header = `BizBuddy system admin recovery codes${username ? ` (${username})` : ""}\nEach code works once.\n\n`;
    const url = URL.createObjectURL(new Blob([header + text + "\n"], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "bizbuddy-system-admin-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Save your recovery codes</h2>
        <p className="text-sm text-muted-foreground">
          If you lose your phone, each of these codes lets you sign in once. They won&apos;t be shown again.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-4 font-mono text-sm">
        {codes.map((c) => (
          <span key={c} className="text-center text-foreground">
            {c}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={handleCopy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={handleDownload}>
          <Download /> Download (.txt)
        </Button>
      </div>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} className="mt-0.5" />
        <span>I&apos;ve saved these codes. Each works once if I lose my phone.</span>
      </label>

      <Button type="button" className="w-full" disabled={!saved} onClick={onContinue}>
        {continueLabel}
      </Button>
    </div>
  );
}
