"use strict";

async function disbursementRequest(apiUrl, token, path, { method = "GET", body } = {}) {
  const response = await fetch(`${apiUrl}/api/disbursements${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || "Disbursement request failed");
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }

  return payload?.data;
}

export function fetchDisbursementSummary(apiUrl, token) {
  return disbursementRequest(apiUrl, token, "/summary");
}

export function fetchDisbursementBatches(apiUrl, token, params = {}) {
  const search = new URLSearchParams();
  if (params.payrollRunId) search.set("payrollRunId", params.payrollRunId);
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  return disbursementRequest(apiUrl, token, query ? `/?${query}` : "/");
}

export function fetchDisbursementBatch(apiUrl, token, batchId) {
  return disbursementRequest(apiUrl, token, `/${batchId}`);
}

export const UNVERIFIED_PAYMENT_PAYSLIP_MESSAGE =
  "Verify this employee's payment in Disbursement before sending a payslip";

export async function fetchPaidEmployeeIdsForPayrollRun(apiUrl, token, payrollRunId) {
  const ids = new Set();
  if (!apiUrl || !token || !payrollRunId) return ids;

  const list = await fetchDisbursementBatches(apiUrl, token, {
    payrollRunId,
    limit: 50,
  });

  const batches = (list?.batches || []).filter(
    (batch) =>
      String(batch.payrollRunId) === String(payrollRunId) &&
      batch.status !== "CANCELLED" &&
      batch.id
  );

  const details = await Promise.all(
    batches.map((batch) => fetchDisbursementBatch(apiUrl, token, batch.id))
  );

  details.forEach((batch) => {
    (batch?.recipients || []).forEach((recipient) => {
      if (recipient?.status !== "PAID") return;
      if (recipient.employeeId) ids.add(String(recipient.employeeId));
      if (recipient.userId) ids.add(String(recipient.userId));
    });
  });

  return ids;
}

export function createDisbursementFromPayrollRun(apiUrl, token, payrollRunId) {
  return disbursementRequest(apiUrl, token, `/from-payroll-run/${payrollRunId}`, {
    method: "POST",
  });
}

export function approveDisbursementBatch(apiUrl, token, batchId) {
  return disbursementRequest(apiUrl, token, `/${batchId}/approve`, { method: "POST" });
}

export function cancelDisbursementBatch(apiUrl, token, batchId) {
  return disbursementRequest(apiUrl, token, `/${batchId}/cancel`, { method: "POST" });
}

export async function markDisbursementPaid(apiUrl, token, batchId, { paymentMethod, file }) {
  const form = new FormData();
  form.append("paymentMethod", paymentMethod);
  if (file) form.append("proof", file);

  const response = await fetch(`${apiUrl}/api/disbursements/${batchId}/mark-paid`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || "Failed to mark payment sent");
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }

  return payload?.data;
}

export async function markRecipientPaymentSent(apiUrl, token, batchId, recipientId, { paymentMethod, file }) {
  const form = new FormData();
  form.append("paymentMethod", paymentMethod);
  if (file) form.append("proof", file);

  const response = await fetch(
    `${apiUrl}/api/disbursements/${batchId}/recipients/${recipientId}/mark-paid`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || "Failed to mark employee payment sent");
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }

  return payload?.data;
}

export async function fetchDisbursementPaymentProof(apiUrl, token, batchId) {
  const response = await fetch(`${apiUrl}/api/disbursements/${batchId}/payment-proof`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || "Failed to load payment proof");
  }
  return response.blob();
}

export async function fetchRecipientPaymentProof(apiUrl, token, batchId, recipientId) {
  const response = await fetch(
    `${apiUrl}/api/disbursements/${batchId}/recipients/${recipientId}/payment-proof`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || "Failed to load employee payment proof");
  }
  return response.blob();
}

export const DISBURSEMENT_STATUS_LABELS = {
  DRAFT: "Draft",
  READY_FOR_REVIEW: "Ready for Review",
  APPROVED: "Approved",
  READY_FOR_DISBURSEMENT: "Ready for Disbursement",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  NEEDS_REVIEW: "Needs Review",
  CANCELLED: "Cancelled",
};

export const RECIPIENT_STATUS_LABELS = {
  PENDING: "Pending",
  READY: "Ready",
  WARNING: "Warning",
  BLOCKED: "Blocked",
  FAILED: "Failed",
  PAID: "Paid",
};

export function formatDisbursementCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

export function formatDisbursementDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function formatDisbursementDay(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function disbursementStatusClass(status) {
  switch (status) {
    case "COMPLETED":
    case "READY":
    case "PAID":
      return "bg-green-100 text-green-800 border-green-200";
    case "READY_FOR_DISBURSEMENT":
    case "APPROVED":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "READY_FOR_REVIEW":
    case "DRAFT":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "PROCESSING":
    case "WARNING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "FAILED":
    case "BLOCKED":
    case "NEEDS_REVIEW":
      return "bg-red-100 text-red-800 border-red-200";
    case "CANCELLED":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export const PAYMENT_METHOD_LABELS = {
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  OTHER: "Other",
};

export function canCreateDisbursement(role) {
  return ["admin", "superadmin"].includes(String(role || "").toLowerCase());
}

export function canApproveDisbursement(role) {
  return ["admin", "supervisor", "superadmin"].includes(String(role || "").toLowerCase());
}

export function canMarkPaymentSent(role) {
  return ["admin", "superadmin"].includes(String(role || "").toLowerCase());
}

export function canViewDisbursement(role) {
  return ["admin", "supervisor", "superadmin"].includes(String(role || "").toLowerCase());
}
