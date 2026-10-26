import { isMockPayrollId } from '@/lib/mockPayrollData';
import {
  fetchPaidEmployeeIdsForPayrollRun,
  UNVERIFIED_PAYMENT_PAYSLIP_MESSAGE,
} from '@/lib/disbursementApi';

function payslipPdfUrl(apiUrl, payrollRunId, employeeId) {
  return `${apiUrl}/api/payroll-system/generate-payslip-pdf/${payrollRunId}/${employeeId}`;
}

function sendPayslipUrl(apiUrl, payrollRunId, employeeId) {
  return `${apiUrl}/api/payroll-system/send-payslip-email/${payrollRunId}/${employeeId}`;
}

export function isValidEmployeeEmail(email) {
  if (!email || email === '—') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function viewPayslipPdf({ apiUrl, token, payrollRunId, employeeId }) {
  if (isMockPayrollId(payrollRunId)) {
    throw new Error('PDF preview is not available for demo payroll runs.');
  }

  const response = await fetch(payslipPdfUrl(apiUrl, payrollRunId, employeeId), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to generate payslip');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => window.URL.revokeObjectURL(url), 100);
}

export async function downloadPayslipPdf({ apiUrl, token, payrollRunId, employeeId }) {
  if (isMockPayrollId(payrollRunId)) {
    throw new Error('PDF download is not available for demo payroll runs.');
  }

  const response = await fetch(payslipPdfUrl(apiUrl, payrollRunId, employeeId), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to generate payslip');
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'payslip.pdf';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) filename = match[1].replace(/['"]/g, '');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function sendPayslipEmail({ apiUrl, token, payrollRunId, employeeId, email }) {
  if (isMockPayrollId(payrollRunId)) {
    throw new Error('Email delivery is not available for demo payroll runs.');
  }

  const paidEmployeeIds = await fetchPaidEmployeeIdsForPayrollRun(apiUrl, token, payrollRunId);
  if (!paidEmployeeIds.has(String(employeeId))) {
    throw new Error(UNVERIFIED_PAYMENT_PAYSLIP_MESSAGE);
  }

  const response = await fetch(sendPayslipUrl(apiUrl, payrollRunId, employeeId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(email ? { email } : {}),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || 'Failed to send payslip');
  }

  return result;
}

export async function sendAllPayslipEmails({ apiUrl, token, payrollRunId, employeeIds = [] }) {
  if (isMockPayrollId(payrollRunId)) {
    throw new Error('Email delivery is not available for demo payroll runs.');
  }

  if (!payrollRunId) {
    throw new Error('Save payroll first before sending payslips');
  }

  const paidEmployeeIds = await fetchPaidEmployeeIdsForPayrollRun(apiUrl, token, payrollRunId);
  const eligibleIds = employeeIds.filter((employeeId) => paidEmployeeIds.has(String(employeeId)));
  if (!eligibleIds.length) {
    throw new Error(UNVERIFIED_PAYMENT_PAYSLIP_MESSAGE);
  }

  let sent = 0;
  const errors = [];

  for (const employeeId of eligibleIds) {
    try {
      await sendPayslipEmail({ apiUrl, token, payrollRunId, employeeId });
      sent += 1;
    } catch (err) {
      errors.push(err.message || 'Send failed');
    }
  }

  if (sent === 0) {
    const uniqueErrors = [...new Set(errors.filter(Boolean))];
    throw new Error(uniqueErrors[0] || 'Failed to send payslips');
  }

  return { success: true, sent, failed: eligibleIds.length - sent };
}
