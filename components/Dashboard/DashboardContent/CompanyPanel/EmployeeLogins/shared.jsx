"use client";

import { Globe, HelpCircle, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API = process.env.NEXT_PUBLIC_API_URL;
const BASE = "/api/employee-logins";

export class LoginsApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// GET under the page's base path; empty query values are left out
export async function loginsGet(token, path = "", query = {}) {
  const qp = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  ).toString();
  const res = await fetch(`${API}${BASE}${path}${qp ? `?${qp}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new LoginsApiError(j.message || `Request failed (${res.status})`, res.status);
  return j.data;
}

export const OUTCOME_LABEL = {
  success: "Success",
  wrong_password: "Wrong password",
  user_not_found: "Unknown email",
  inactive: "Inactive account",
  device_switch_cooldown: "Phone switch cooldown",
  device_already_registered: "Phone registered to another account",
  agent_denied: "B. Buddy denied",
  invalid_request: "Invalid request",
  denied: "Denied (older history)",
  error: "Server error",
};
export const outcomeLabel = (o) => OUTCOME_LABEL[o] || o || "—";

export const EVENT_LABEL = { sign_in: "Sign-in", sign_out: "Sign-out" };

export const FLAGS = [
  { key: "platformSwitch", label: "Switch", title: "Platform switch", help: "Signed in on a different platform than last time (mobile ↔ web)." },
  { key: "newDevice", label: "New device", title: "New device", help: "A phone or browser this employee never used before." },
  { key: "sharedDevice", label: "Shared", title: "Shared device", help: "This phone or browser also signed in to another account." },
  { key: "failedBurst", label: "Failed burst", title: "Failed burst", help: "3 or more failed attempts for the same email within 15 minutes." },
];

// "a1b2c3d4e5…" → "a1b2c3d4"
export const shortId = (id) => (id ? (String(id).length > 10 ? `${String(id).slice(0, 8)}…` : String(id)) : "—");

export function fmtWhen(value, timeZone) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    });
  } catch { return "—"; }
}

export function PlatformIcon({ platform, className = "h-4 w-4" }) {
  const Icon = platform === "mobile" ? Smartphone : platform === "web" ? Globe : HelpCircle;
  const label = platform === "mobile" ? "Mobile" : platform === "web" ? "Web" : "Other";
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={label}>
      <Icon className={className} aria-hidden />
      <span className="text-xs">{label}</span>
    </span>
  );
}

// "Jane Doe, Bob Reyes · 1 account in another company"
export function sharedWithText(sharedWith) {
  if (!sharedWith) return "";
  const names = (sharedWith.sameCompany || []).map((p) => p.name).filter(Boolean);
  const other = sharedWith.otherCompanyAccounts || 0;
  const parts = [];
  if (names.length) parts.push(names.join(", "));
  if (other) parts.push(`${other} account${other === 1 ? "" : "s"} in another company`);
  return parts.join(" · ");
}

export function FlagChips({ flags, sharedWith }) {
  const on = FLAGS.filter((f) => flags?.[f.key]);
  if (!on.length) return <span className="text-muted-foreground">—</span>;
  return (
    <TooltipProvider delayDuration={200}>
      <span className="inline-flex flex-wrap gap-1">
        {on.map((f) => {
          const strong = f.key === "sharedDevice" || f.key === "failedBurst";
          const tip = f.key === "sharedDevice" && sharedWithText(sharedWith)
            ? `Also used by: ${sharedWithText(sharedWith)}`
            : f.help;
          return (
            <Tooltip key={f.key}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Badge
                    variant="outline"
                    className={`cursor-help text-[10px] font-semibold ${strong ? "text-red-700 border-red-300 dark:text-red-400 dark:border-red-800" : ""}`}
                  >
                    {f.label}
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{tip}</TooltipContent>
            </Tooltip>
          );
        })}
      </span>
    </TooltipProvider>
  );
}

export const employeeName = (e) => {
  const n = `${e?.profile?.firstName ?? ""} ${e?.profile?.lastName ?? ""}`.trim();
  return n || e?.email || e?.username || "Unnamed";
};
