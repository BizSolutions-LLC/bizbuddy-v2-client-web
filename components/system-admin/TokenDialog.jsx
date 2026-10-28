// components/system-admin/TokenDialog.jsx
//
// "View token" dialog — opened from the account menu in SystemAdminNav.

"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSystemAdminToken } from "@/lib/systemAdminFetch";

export default function TokenDialog({ open, onOpenChange }) {
  const [token, setToken] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setToken(getSystemAdminToken());
    } else {
      // Always re-mask on close so the token never stays visible
      setRevealed(false);
      setCopied(false);
    }
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy token error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>System Admin Token</DialogTitle>
          <DialogDescription>
            The token returned by the system admin login for this session.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="space-y-3">
            <div className="max-h-48 overflow-y-auto rounded-md border bg-muted p-3 font-mono text-xs break-all text-foreground">
              {revealed ? token : "••••••••••••••••••••••••••••••••"}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRevealed((prev) => !prev)}>
                {revealed ? <EyeOff /> : <Eye />}
                {revealed ? "Hide" : "Reveal"}
              </Button>
              <Button size="sm" onClick={handleCopy}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Treat this like a password — anyone with it has system admin access.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No token found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
