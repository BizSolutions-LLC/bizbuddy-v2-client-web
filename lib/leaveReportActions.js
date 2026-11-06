// lib/leaveReportActions.js
// BB-106 — Leave Report workbook. The server builds the .xlsx (GET /api/reports/leave/template);
// the client only sends filters and downloads the file. Same flow as yearlyHoursReportActions.js.

export async function downloadLeaveTemplateReport({
  apiUrl, token, year, quarters, months, policyIds, departmentId, userIds, includeInactive, fallbackFilename,
}) {
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  // Server rejects quarters + months together (400) — callers pass only one.
  if (quarters?.length) params.set('quarters', quarters.join(','));
  else if (months?.length) params.set('months', months.join(','));
  if (policyIds?.length) params.set('policyIds', policyIds.join(','));
  if (departmentId) params.set('departmentId', String(departmentId));
  if (userIds?.length) params.set('userIds', userIds.join(','));
  if (includeInactive) params.set('includeInactive', 'true');

  const response = await fetch(`${apiUrl}/api/reports/leave/template?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  // Failures come back as JSON { message } instead of a workbook.
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to generate report (${response.status})`);
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = fallbackFilename;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) filename = match[1].replace(/['"]/g, '');
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);

  return filename;
}
