// lib/taskReportFormsApi.js
//
// BB-129 phase 1: custom clock-out forms (questionnaires the admin builds), /api/task-report-forms.
// Admin / superadmin only; anyone else gets 403. The server checks every rule below;
// the client mirrors them only to give early feedback. Errors come back as { message, code? }.

export const TASK_REPORT_MODES = { freeform: "freeform", forms: "forms" };

export const FORM_LIMITS = {
  name: 120,
  description: 1000,
  minQuestions: 1,
  maxQuestions: 100,
  label: 300,
  helpText: 500,
  minOptions: 1,
  maxOptions: 50,
  option: 200,
};

// Order = order shown in the "Add question" picker.
export const QUESTION_TYPES = [
  { type: "short_text",    label: "Short answer",                 hasOptions: false },
  { type: "paragraph",     label: "Paragraph",                    hasOptions: false },
  { type: "single_choice", label: "Multiple choice (one answer)", hasOptions: true },
  { type: "checkboxes",    label: "Checkboxes",                   hasOptions: true },
  { type: "dropdown",      label: "Dropdown",                     hasOptions: true },
  { type: "yes_no",        label: "Yes / No",                     hasOptions: false },
  { type: "number",        label: "Number",                       hasOptions: false },
  { type: "date",          label: "Date",                         hasOptions: false },
  { type: "time",          label: "Time",                         hasOptions: false },
];

export const questionTypeLabel = (type) => QUESTION_TYPES.find((t) => t.type === type)?.label || type;
export const isChoiceType = (type) => Boolean(QUESTION_TYPES.find((t) => t.type === type)?.hasOptions);

// New questions get a temporary id (letters, digits, _ or -, ≤ 40) so React can key them;
// the server replaces it with a stable one on save.
export const TEMP_ID_PREFIX = "tmp-";
export const newTempId = () => `${TEMP_ID_PREFIX}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export class TaskReportFormsApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code || null;
  }
}

async function call(apiUrl, token, path, init = {}) {
  const res = await fetch(`${apiUrl}/api/task-report-forms${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new TaskReportFormsApiError(j.message || j.error || `Request failed (${res.status})`, res.status, j.code);
  return j;
}

// ── Forms ────────────────────────────────────────────────────────────────────
// status: "active" (default) | "archived" | "all". Returns { data, questionTypes }; list rows have no questions.
export async function listForms(apiUrl, token, status = "active") {
  const j = await call(apiUrl, token, `?status=${encodeURIComponent(status)}`);
  return { data: j.data || [], questionTypes: j.questionTypes || [] };
}

export async function getForm(apiUrl, token, id) {
  return (await call(apiUrl, token, `/${encodeURIComponent(id)}`)).data;
}

export async function createForm(apiUrl, token, body) {
  return (await call(apiUrl, token, "", { method: "POST", body: JSON.stringify(body) })).data;
}

export async function updateForm(apiUrl, token, id, body) {
  return (await call(apiUrl, token, `/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })).data;
}

// Without a name the server names it "Copy of X" (then "Copy of X (2)", …). The copy is active.
export async function duplicateForm(apiUrl, token, id, name) {
  const body = name && name.trim() ? { name: name.trim() } : {};
  return (await call(apiUrl, token, `/${encodeURIComponent(id)}/duplicate`, { method: "POST", body: JSON.stringify(body) })).data;
}

export async function archiveForm(apiUrl, token, id) {
  return (await call(apiUrl, token, `/${encodeURIComponent(id)}/archive`, { method: "POST" })).data;
}

export async function restoreForm(apiUrl, token, id) {
  return (await call(apiUrl, token, `/${encodeURIComponent(id)}/restore`, { method: "POST" })).data;
}

export async function deleteForm(apiUrl, token, id) {
  return (await call(apiUrl, token, `/${encodeURIComponent(id)}`, { method: "DELETE" })).data;
}

// ── Builder helpers ──────────────────────────────────────────────────────────

// The body sent on create / save. Question order = array order. Options are dropped for
// non-choice types (the server drops them too) and blank options are trimmed away.
export function toFormPayload(draft) {
  return {
    name: (draft.name || "").trim(),
    description: (draft.description || "").trim(),
    questions: (draft.questions || []).map((q) => ({
      id: q.id,
      type: q.type,
      label: (q.label || "").trim(),
      helpText: (q.helpText || "").trim(),
      required: Boolean(q.required),
      options: isChoiceType(q.type) ? (q.options || []).map((o) => o.trim()) : [],
    })),
  };
}

// Mirrors the server's rules. Returns { form: string[], questions: { [id]: string[] } };
// empty arrays everywhere mean OK.
export function validateForm(draft) {
  const L = FORM_LIMITS;
  const form = [];
  const questions = {};
  const name = (draft.name || "").trim();
  if (!name) form.push("Give the form a name.");
  else if (name.length > L.name) form.push(`The name can be at most ${L.name} characters.`);
  if ((draft.description || "").trim().length > L.description) form.push(`The description can be at most ${L.description} characters.`);

  const qs = draft.questions || [];
  if (qs.length < L.minQuestions) form.push("Add at least one question.");
  if (qs.length > L.maxQuestions) form.push(`A form can have at most ${L.maxQuestions} questions.`);

  qs.forEach((q) => {
    const errs = [];
    const label = (q.label || "").trim();
    if (!label) errs.push("Question text is required.");
    else if (label.length > L.label) errs.push(`Question text can be at most ${L.label} characters.`);
    if ((q.helpText || "").trim().length > L.helpText) errs.push(`Help text can be at most ${L.helpText} characters.`);
    if (isChoiceType(q.type)) {
      const opts = (q.options || []).map((o) => o.trim());
      if (opts.length < L.minOptions) errs.push("Add at least one option.");
      if (opts.length > L.maxOptions) errs.push(`At most ${L.maxOptions} options.`);
      if (opts.some((o) => !o)) errs.push("Options can't be empty.");
      if (opts.some((o) => o.length > L.option)) errs.push(`Each option can be at most ${L.option} characters.`);
      const seen = new Set();
      if (opts.some((o) => { const k = o.toLowerCase(); if (o && seen.has(k)) return true; seen.add(k); return false; })) {
        errs.push("Options must be different from each other.");
      }
    }
    if (errs.length) questions[q.id] = errs;
  });
  return { form, questions };
}

export const hasErrors = (v) => v.form.length > 0 || Object.keys(v.questions).length > 0;

// ═════════════════════════════════════════════════════════════════════════════
// BB-129 phase 2: assignments, answering, history, viewing one answer set.
// Modes are exclusive: "forms" turns the free-form report off (403 TASK_REPORT_MODE_FORMS).
// ═════════════════════════════════════════════════════════════════════════════

// Company setting taskReportFormWindowHours: whole hours, 1–2160 (90 days), default 336 (14 days).
export const FORM_WINDOW = { min: 1, max: 2160, default: 336 };
export const FORM_WINDOW_PRESETS = [
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
  { hours: 336, label: "14 days" },
];
export function fmtWindowHours(h) {
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n % 24 === 0) return `${n / 24} day${n === 24 ? "" : "s"}`;
  return `${n} hour${n === 1 ? "" : "s"}`;
}

// ── Assignments (admin) ──────────────────────────────────────────────────────
// Most specific wins: shift → employee → department → all. Order here = that order.
export const ASSIGNMENT_SCOPES = [
  { id: "shift",      label: "Shift",      hint: "Everyone working this shift" },
  { id: "employee",   label: "Employee",   hint: "One employee, any shift" },
  { id: "department", label: "Department", hint: "Everyone in the department" },
  { id: "all",        label: "Everyone",   hint: "Anyone not matched above" },
];
export const scopeLabel = (s) => ASSIGNMENT_SCOPES.find((x) => x.id === s)?.label || s;
export const scopeRank = (s) => {
  const i = ASSIGNMENT_SCOPES.findIndex((x) => x.id === s);
  return i === -1 ? 99 : i;
};

export async function listAssignments(apiUrl, token) {
  const j = await call(apiUrl, token, "/assignments");
  return { data: j.data || [], scopes: j.scopes || [] };
}

// One form per target: assigning again replaces the form. scope "all" has no targetId.
export async function putAssignment(apiUrl, token, { scope, targetId, formId }) {
  const body = scope === "all" ? { scope, formId } : { scope, targetId, formId };
  return (await call(apiUrl, token, "/assignments", { method: "PUT", body: JSON.stringify(body) })).data;
}

export async function deleteAssignment(apiUrl, token, id) {
  return (await call(apiUrl, token, `/assignments/${encodeURIComponent(id)}`, { method: "DELETE" })).data;
}

// Pickers for assignment targets. Same endpoints the other admin pages use.
export async function loadAssignmentTargets(apiUrl, token) {
  const get = (path) => fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json().catch(() => ({})))
    .then((j) => (Array.isArray(j?.data) ? j.data : []))
    .catch(() => []);
  const [departments, employees, shifts] = await Promise.all([
    get("/api/departments"), get("/api/employee?all=1"), get("/api/shifts"),
  ]);
  const byLabel = (a, b) => a.label.localeCompare(b.label);
  return {
    department: departments.map((d) => ({ value: d.id, label: d.name || d.id })).sort(byLabel),
    employee: employees.map((e) => {
      const name = `${e.profile?.firstName || ""} ${e.profile?.lastName || ""}`.trim();
      return { value: e.id, label: name || e.email?.split("@")[0] || e.id, sub: e.email || "" };
    }).sort(byLabel),
    shift: shifts.map((s) => ({
      value: s.id,
      label: s.shiftName || s.name || s.id,
      sub: s.startTime && s.endTime ? `${fmtShiftClock(s.startTime)}–${fmtShiftClock(s.endTime)}` : "",
    })).sort(byLabel),
  };
}

function fmtShiftClock(v) {
  // Shift times come back as ISO strings on 1970-01-01 (UTC wall clock) or "HH:mm".
  if (!v) return "";
  if (/^\d{2}:\d{2}/.test(v)) return v.slice(0, 5);
  try {
    return new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  } catch { return ""; }
}

// ── Employee: answering ──────────────────────────────────────────────────────
export const ANSWER_LIMITS = { short_text: 500, paragraph: 5000 };

// { enabled, windowHours, timeZone, items[] }, newest clock-out first.
export async function getMyPending(apiUrl, token) {
  return (await call(apiUrl, token, "/me/pending")).data;
}

// { enabled, timeZone, punch, canEdit, response, form: { id, name, description, questions }, shiftName, closesAt }
export async function getMyPunchForm(apiUrl, token, timeLogId) {
  return (await call(apiUrl, token, `/me/punch/${encodeURIComponent(timeLogId)}`)).data;
}

// BB-141: the questionnaire for the punch that is still open, asked before clock-out.
// { required: false, timeLogId } or { required: true, timeLogId, assignedVia, shift: { id, name } | null,
//   form: { id, name, description, questions } }. 404 NO_OPEN_PUNCH when not clocked in.
// When required, /time-out must carry { answers } (submitted with the punch).
export async function getMyOpenForm(apiUrl, token) {
  return (await call(apiUrl, token, "/me/open")).data;
}

// submit: true locks the answers. Returns { message?, data: response }.
export async function saveMyPunchForm(apiUrl, token, timeLogId, { answers, submit }) {
  return call(apiUrl, token, `/me/punch/${encodeURIComponent(timeLogId)}`, {
    method: "PUT",
    body: JSON.stringify({ answers, submit: Boolean(submit) }),
  });
}

export const MAX_RESPONSE_RANGE_DAYS = 93;
const dayDiff = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

// { responses[] , ... } for a from/to range (default last 30 days, max 93).
export async function listMyResponses(apiUrl, token, { from, to } = {}) {
  const qp = new URLSearchParams();
  if (from) qp.set("from", from);
  if (to) qp.set("to", to);
  const s = qp.toString();
  return (await call(apiUrl, token, `/me/responses${s ? `?${s}` : ""}`)).data;
}

// Responses for a set of "YYYY-MM-DD" days, as a Map timeLogId → response summary.
// Far-apart days are split into several calls (93-day limit).
export async function listMyResponsesForDates(apiUrl, token, dates) {
  const sorted = [...new Set(dates.filter(Boolean))].sort();
  const ranges = [];
  for (const d of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && dayDiff(last.from, d) <= MAX_RESPONSE_RANGE_DAYS) last.to = d;
    else ranges.push({ from: d, to: d });
  }
  const results = await Promise.all(ranges.map((r) => listMyResponses(apiUrl, token, r)));
  const map = new Map();
  results.forEach((data) => (data?.responses || []).forEach((r) => { if (r.timeLogId) map.set(r.timeLogId, r); }));
  return map;
}

// Owner (any status) or supervisor/admin (submitted + incomplete only).
export async function getResponse(apiUrl, token, id) {
  return (await call(apiUrl, token, `/responses/${encodeURIComponent(id)}`)).data;
}

export const RESPONSE_STATUS_LABEL = { draft: "Draft", submitted: "Submitted", incomplete: "Incomplete" };

// ── Answer values ────────────────────────────────────────────────────────────
// In the editor UI every value is kept in an input-friendly shape:
//   text / choice / date / time → string; checkboxes → string[]; yes_no → true/false; number → string.
// toAnswerPayload converts to the API shape and leaves unanswered questions out.

export function isAnswered(q, v) {
  if (v === undefined || v === null) return false;
  if (q.type === "checkboxes") return Array.isArray(v) && v.length > 0;
  if (q.type === "yes_no") return v === true || v === false;
  return String(v).trim() !== "";
}

export function fromServerAnswers(questions, answers) {
  const out = {};
  (questions || []).forEach((q) => {
    const v = answers?.[q.id];
    if (v === undefined || v === null) return;
    if (q.type === "number") out[q.id] = String(v);
    else if (q.type === "checkboxes") out[q.id] = Array.isArray(v) ? v.map(String) : [];
    else if (q.type === "yes_no") out[q.id] = v === true || v === "true" ? true : v === false || v === "false" ? false : undefined;
    else out[q.id] = String(v);
  });
  return out;
}

export function toAnswerPayload(questions, values) {
  const out = {};
  (questions || []).forEach((q) => {
    const v = values?.[q.id];
    if (!isAnswered(q, v)) return;
    switch (q.type) {
      case "short_text":
      case "paragraph": out[q.id] = String(v).trim(); break;
      case "number": {
        const n = Number(String(v).trim());
        out[q.id] = Number.isFinite(n) ? n : String(v).trim(); // let the server name a bad value
        break;
      }
      case "checkboxes": out[q.id] = (q.options || []).filter((o) => v.includes(o)); break; // keep the listed order
      case "yes_no": out[q.id] = v === true; break;
      default: out[q.id] = String(v);
    }
  });
  return out;
}

// Client-side check before submit (the server repeats it). Returns { [questionId]: message }.
export function validateAnswers(questions, values, { submit }) {
  const errs = {};
  (questions || []).forEach((q) => {
    const v = values?.[q.id];
    const answered = isAnswered(q, v);
    if (submit && q.required && !answered) { errs[q.id] = "This question is required."; return; }
    if (!answered) return;
    const max = ANSWER_LIMITS[q.type];
    if (max && String(v).trim().length > max) errs[q.id] = `At most ${max} characters.`;
    if (q.type === "number" && !Number.isFinite(Number(String(v).trim()))) errs[q.id] = "Enter a number.";
  });
  return errs;
}

// Read-only display of one answer.
export function fmtAnswer(q, v) {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return null;
  switch (q.type) {
    case "yes_no": return v === true || v === "true" ? "Yes" : "No";
    case "checkboxes": return Array.isArray(v) ? v.join(", ") : String(v);
    case "date": {
      const d = new Date(`${v}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? String(v)
        : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    }
    case "time": {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(v));
      if (!m) return String(v);
      const h = Number(m[1]);
      return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
    }
    default: return String(v);
  }
}

// BB-129 phase 2, section 10: PDF of one submitted answer set (drafts / Incomplete → 409 NOT_SUBMITTED).
// Same access as getResponse. Fetch with lib/reportDownload.js (auth header → blob).
export const responsePdfPath = (id, { inline = false } = {}) =>
  `/api/task-report-forms/responses/${encodeURIComponent(id)}/pdf${inline ? "?disposition=inline" : ""}`;
