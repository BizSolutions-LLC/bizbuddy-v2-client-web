export async function downloadYearlyTotalHoursReport({
  apiUrl, token, companyId, year, groupBy, periods, columns, fallbackFilename,
}) {
  if (!companyId) throw new Error('Company not resolved yet');

  const url = new URL(`${apiUrl}/api/reports/yearly-total-hours/${companyId}`);
  if (year) url.searchParams.set('year', String(year));
  if (groupBy) url.searchParams.set('groupBy', groupBy);
  if (periods?.length) url.searchParams.set('periods', periods.join(','));
  if (columns?.length) url.searchParams.set('columns', columns.join(','));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

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
}
