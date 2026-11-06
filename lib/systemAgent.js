// lib/systemAgent.js
//
// BB-110: B. Buddy — the hidden per-company admin account used by BizBuddy
// support staff. It works the Company panel only; the server enforces this,
// these helpers keep the UI in line with it.

import { jwtDecode } from "jwt-decode";

// Where B. Buddy lands instead of the Employee panel overview
export const SYSTEM_AGENT_HOME = "/dashboard/company/employees";

// Employee-panel / self-service / company-deletion routes B. Buddy can't use
const BLOCKED_PREFIXES = [
  "/dashboard/employee",
  "/dashboard/user",
  "/dashboard/company/deletion",
];

// Admin tools that live under the Employee panel but are company-wide
const ALLOWED_PREFIXES = ["/dashboard/employee/payroll"];

// The login token carries isSystemAgent: true for B. Buddy sign-ins
export function isSystemAgentToken(token) {
  if (!token) return false;
  try {
    return jwtDecode(token)?.isSystemAgent === true;
  } catch {
    return false;
  }
}

const matches = (pathname, p) => pathname === p || pathname.startsWith(`${p}/`);

export function isBlockedForSystemAgent(pathname = "") {
  if (ALLOWED_PREFIXES.some((p) => matches(pathname, p))) return false;
  return BLOCKED_PREFIXES.some((p) => matches(pathname, p));
}

const SYSTEM_AGENT_MESSAGES = {
  SYSTEM_AGENT_NOT_ALLOWED: "This action isn't available in support mode.",
  SYSTEM_AGENT_PROTECTED: "The B. Buddy account is managed by BizBuddy and can't be changed here.",
};

// Friendly message for the B. Buddy 403 codes, or null for anything else.
// Usage: setError(getSystemAgentErrorMessage(data) || data.message || "...")
export function getSystemAgentErrorMessage(data) {
  return SYSTEM_AGENT_MESSAGES[data?.code] || null;
}
