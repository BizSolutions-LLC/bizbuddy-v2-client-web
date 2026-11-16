// lib/taskReportsApi.js
//
// BB-129: clock-out documentation (Daily Task Report), trial. Server v2.11.13, /api/task-reports.
// The server owns every rule (one report per company-zone day of the clock-in, limits,
// who can see what). This file only calls it. Errors come back as { message, code? }.

export const TASK_LIMITS = { maxTasks: 50, title: 200, note: 1000 };
export const MAX_RANGE_DAYS = 93;

// Fired on window when an admin flips the setting, so the sidebar can show or hide
// "Employee Report" without a reload. detail: { enabled: boolean }
export const TASK_REPORT_SETTING_EVENT = "bizbuddy:task-report-setting";

export function announceTaskReportSetting(enabled) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TASK_REPORT_SETTING_EVENT, { detail: { enabled: Boolean(enabled) } }));
}

export class TaskReportApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code || null;
  }
}

async function call(apiUrl, token, path, init = {}) {
  const res = await fetch(`${apiUrl}/api/task-reports${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new TaskReportApiError(j.message || `Request failed (${res.status})`, res.status, j.code);
  return j;
}

const query = (params) => {
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qp.set(k, v); });
  const s = qp.toString();
  return s ? `?${s}` : "";
};

// ── Company setting ──────────────────────────────────────────────────────────
export async function fetchTaskReportEnabled(apiUrl, token) {
  const res = await fetch(`${apiUrl}/api/company-settings`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new TaskReportApiError(j.message || "Failed to load company settings", res.status, j.code);
  return Boolean(j.data?.taskReportEnabled);
}

// ── Employee: own reports ────────────────────────────────────────────────────
export async function listMyReports(apiUrl, token, { from, to }) {
  return (await call(apiUrl, token, `/me${query({ from, to })}`)).data;
}

const dayDiff = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

/**
 * Report summaries for a set of "YYYY-MM-DD" days, as a Map date → { status, taskCount, submittedAt }.
 * The server allows at most 93 days per call, so far-apart days are split into several calls.
 */
export async function listMyReportsForDates(apiUrl, token, dates) {
  const sorted = [...new Set(dates.filter(Boolean))].sort();
  const ranges = [];
  for (const d of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && dayDiff(last.from, d) <= MAX_RANGE_DAYS) last.to = d;
    else ranges.push({ from: d, to: d });
  }
  const results = await Promise.all(ranges.map((r) => listMyReports(apiUrl, token, r)));
  const map = new Map();
  results.forEach((data) => (data?.reports || []).forEach((r) => map.set(r.reportDate, r)));
  return map;
}

export async function getMyReport(apiUrl, token, date) {
  return (await call(apiUrl, token, `/me/${date}`)).data;
}

/** PUT /me/:date { tasks, submit }. Returns { message, data: report }. */
export async function saveMyReport(apiUrl, token, date, { tasks, submit }) {
  return call(apiUrl, token, `/me/${date}`, { method: "PUT", body: JSON.stringify({ tasks, submit: Boolean(submit) }) });
}

export const myReportPdfPath = (date) => `/api/task-reports/me/${date}/pdf`;

// ── Supervisor / admin: view only ────────────────────────────────────────────
export async function listTeamReports(apiUrl, token, { from, to, userId, departmentId }) {
  return (await call(apiUrl, token, `/team${query({ from, to, userId, departmentId })}`)).data;
}

export async function getTeamReport(apiUrl, token, id) {
  return (await call(apiUrl, token, `/${encodeURIComponent(id)}`)).data;
}

export const teamReportPdfPath = (id) => `/api/task-reports/${encodeURIComponent(id)}/pdf`;

// ── Formatting (always in the response's time zone, never the browser's) ─────
export function fmtTimeInZone(value, timeZone) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone });
  } catch {
    return "—";
  }
}

export function fmtDateTimeInZone(value, timeZone) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone,
    });
  } catch {
    return "—";
  }
}

/** "YYYY-MM-DD" → "Mon, Nov 16, 2026". A calendar day, so it is read as UTC on purpose. */
export function fmtReportDate(ymd) {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
