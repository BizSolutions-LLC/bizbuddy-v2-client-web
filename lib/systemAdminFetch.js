// lib/systemAdminFetch.js
//
// BB-110: shared fetch for every system-admin endpoint. Sends the session as a
// Bearer token (the server's httpOnly cookie is sameSite=strict, so it only
// helps when the dashboard and API share a domain). A 401 means the session is
// gone — logged out, expired, deactivated or 2FA reset — so it sends the admin
// back to sign-in instead of letting the page show empty data.

const API = process.env.NEXT_PUBLIC_API_URL;
const TOKEN_KEY = "system-admin-token";
export const SYSTEM_ADMIN_LOGIN = "/system-admin/login";
// sessionStorage: recovery codes left after a sign-in, when it's 3 or fewer
export const RECOVERY_LEFT_KEY = "system-admin-recovery-left";
// sessionStorage: one-off message for the sign-in page (e.g. after a password change)
export const LOGIN_NOTICE_KEY = "system-admin-login-notice";

export function getSystemAdminToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setSystemAdminToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearSystemAdminToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export class SystemAdminError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * path: e.g. "/api/system-admin/overview"
 * options.redirectOn401: false for the sign-in steps, where 401 is a normal answer
 */
export async function systemAdminFetch(path, { method = "GET", query, body, redirectOn401 = true } = {}) {
  const params = new URLSearchParams(
    Object.entries(query || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined && v !== false)
  ).toString();

  const token = getSystemAdminToken();
  const res = await fetch(`${API}${path}${params ? `?${params}` : ""}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  // Session 401s carry no code; coded 401s (wrong password / code) are answers to show
  if (res.status === 401 && redirectOn401 && !json.code) {
    clearSystemAdminToken();
    if (typeof window !== "undefined" && window.location.pathname !== SYSTEM_ADMIN_LOGIN) {
      window.location.assign(SYSTEM_ADMIN_LOGIN);
    }
  }

  if (!res.ok || json.success === false) {
    throw new SystemAdminError(json.message || `Request failed (${res.status})`, {
      status: res.status,
      code: json.code,
      data: json,
    });
  }
  return json;
}

/**
 * BB-113: download a file (e.g. a PDF report) from a system-admin endpoint and
 * save it in the browser. Errors come back as JSON { message }, like everywhere else.
 */
export async function systemAdminDownload(path, fallbackName = "download") {
  const token = getSystemAdminToken();
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && !json.code) {
      clearSystemAdminToken();
      if (typeof window !== "undefined") window.location.assign(SYSTEM_ADMIN_LOGIN);
    }
    throw new SystemAdminError(json.message || `Download failed (${res.status})`, { status: res.status, code: json.code, data: json });
  }

  const name = /filename="?([^"]+)"?/.exec(res.headers.get("Content-Disposition") || "")?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
