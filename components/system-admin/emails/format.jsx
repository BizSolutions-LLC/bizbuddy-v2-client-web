// components/system-admin/emails/format.jsx
//
// BB-140: labels and small pieces shared by the Emails page, its detail drawer and the
// test form.

"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// "WELCOME_EMAIL" → "Welcome email", "missedClockIn" → "Missed clock in"
export function humanizeType(type) {
  if (!type) return "—";
  const words = String(type)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Prefer the server's template label (GET /emails/templates); fall back to the key
export function typeLabel(type, templates) {
  const t = (templates || []).find((x) => x.key === type);
  return t?.label || humanizeType(type);
}

// user:<id> / system-admin:<id> / system-admin:provision-company / self-signup / null
export function triggeredByLabel(value) {
  if (!value) return "Automatic (scheduled job)";
  if (value === "self-signup") return "Self sign-up";
  if (value === "system-admin:provision-company") return "System Admin: Add company";
  const [kind, id] = String(value).split(":");
  if (kind === "user") return `Company user · ${id}`;
  if (kind === "system-admin") return `System admin · ${id}`;
  return value;
}

export const COPY_LABEL = {
  expired: "The copy of this email was deleted after 90 days, so there's no preview.",
  none: "No copy of this email was kept (sent before email logging started, or the copy couldn't be saved).",
};

// Sent / Failed badge; a failed one shows the error in a tooltip
export function StatusBadge({ status, error }) {
  if (status !== "failed") {
    return (
      <Badge variant="outline" className="text-green-700 border-green-300 dark:text-green-400 dark:border-green-800">
        Sent
      </Badge>
    );
  }
  const badge = (
    <Badge variant="outline" className="text-red-700 border-red-300 dark:text-red-400 dark:border-red-800">
      Failed
    </Badge>
  );
  if (!error) return badge;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild><span className="inline-flex cursor-help">{badge}</span></TooltipTrigger>
        <TooltipContent className="max-w-xs break-words">{error}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
