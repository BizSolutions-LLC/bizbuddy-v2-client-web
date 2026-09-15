'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import useAuthStore from '@/store/useAuthStore';
import MockPayrollBanner from '@/components/common/MockPayrollBanner';
import PayslipActionButtons from '@/components/payroll/PayslipActionButtons';
import { isMockPayrollId, withMockPayrollReports } from '@/lib/mockPayrollData';
import {
  viewPayslipPdf,
  downloadPayslipPdf,
  sendPayslipEmail,
} from '@/lib/payslipActions';
import { Printer, RefreshCw, FileSpreadsheet } from 'lucide-react';
import {
  downloadPayrollSummaryExcel,
  mapReportEmployeeToSummaryRow,
} from '@/lib/exportPayrollSummary';
import {
  PERIOD_AGGREGATE_ID,
  buildAggregatedPeriodReport,
  getCurrentQuarter,
  getMonthRange,
  getQuarterRange,
  getYearRange,
  getYearsInRange,
  reportMatchesDateRange,
  usesPeriodAggregateView,
} from '@/lib/payrollReportPeriod';

const STICKY_ROW_NUM_LEFT = 'left-0';
const STICKY_NAME_LEFT = 'left-12';

const PERIOD_MODES = [
  { id: 'custom', label: 'Custom Range' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

const QUARTER_OPTIONS = [
  { value: 1, label: 'Q1 (Jan – Mar)' },
  { value: 2, label: 'Q2 (Apr – Jun)' },
  { value: 3, label: 'Q3 (Jul – Sep)' },
  { value: 4, label: 'Q4 (Oct – Dec)' },
];

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function formatCurrency(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num ?? 0);
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

const Reports = () => {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [activeReportTab, setActiveReportTab] = useState('payroll-detail');
  const currentYear = new Date().getFullYear();
  const [periodMode, setPeriodMode] = useState('quarterly');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dateRange, setDateRange] = useState(() => getQuarterRange(currentYear, getCurrentQuarter()));
  const [sortBy, setSortBy] = useState('Pay Date');
  const [search, setSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [payrollReports, setPayrollReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [payslipLoading, setPayslipLoading] = useState({});

  const yearOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  }, [currentYear]);

  const applyPeriodPreset = useCallback((mode, year, quarter, month) => {
    switch (mode) {
      case 'monthly':
        setDateRange(getMonthRange(year, month));
        break;
      case 'quarterly':
        setDateRange(getQuarterRange(year, quarter));
        break;
      case 'yearly':
        setDateRange(getYearRange(year));
        break;
      default:
        break;
    }
  }, []);

  const handlePeriodModeChange = (mode) => {
    setPeriodMode(mode);
    if (mode !== 'custom') {
      applyPeriodPreset(mode, selectedYear, selectedQuarter, selectedMonth);
    }
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
    if (periodMode !== 'custom') {
      applyPeriodPreset(periodMode, year, selectedQuarter, selectedMonth);
    }
  };

  const handleQuarterChange = (quarter) => {
    setSelectedQuarter(quarter);
    if (periodMode === 'quarterly') {
      setDateRange(getQuarterRange(selectedYear, quarter));
    }
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    if (periodMode === 'monthly') {
      setDateRange(getMonthRange(selectedYear, month));
    }
  };

  const periodLabel = useMemo(() => {
    if (periodMode === 'quarterly') {
      return `Q${selectedQuarter} ${selectedYear}`;
    }
    if (periodMode === 'monthly') {
      const monthName = MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label;
      return `${monthName} ${selectedYear}`;
    }
    if (periodMode === 'yearly') {
      return `${selectedYear}`;
    }
    return `${dateRange.from} to ${dateRange.to}`;
  }, [periodMode, selectedQuarter, selectedYear, selectedMonth, dateRange.from, dateRange.to]);

  const fetchPayrollReports = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);

      // Fetch full calendar year(s) — the API filters by pay date (MM-DD), but runs are
      // often saved with today's pay date while the period falls in the selected quarter.
      const years = getYearsInRange(dateRange.from, dateRange.to);
      const yearResults = await Promise.all(
        years.map(async (year) => {
          const params = new URLSearchParams({
            from: '01-01',
            to: '12-31',
            year: String(year),
            sortBy,
          });

          const response = await fetch(
            `${API_URL}/api/payroll-system/payroll-reports?${params}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.message || 'Failed to fetch reports');
          }

          return result.data?.reports || [];
        })
      );

      const apiReports = [...new Map(
        yearResults.flat().map((report) => [report.id, report])
      ).values()];

      const rangeFiltered = apiReports.filter((report) =>
        reportMatchesDateRange(report, dateRange.from, dateRange.to)
      );

      const merged = withMockPayrollReports(rangeFiltered);
      setPayrollReports(merged);
      setUsingMockData(apiReports.length === 0 && merged.length > 0);
      setSelectedRunId((prev) => {
        if (merged.length === 0) return null;
        if (usesPeriodAggregateView(periodMode)) return PERIOD_AGGREGATE_ID;
        if (prev && merged.some((r) => r.id === prev)) return prev;
        return merged[0].id;
      });
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error(error.message || 'Failed to fetch reports');
      setPayrollReports([]);
      setSelectedRunId(null);
    } finally {
      setLoading(false);
    }
  }, [API_URL, token, dateRange.from, dateRange.to, sortBy, periodMode]);

  useEffect(() => {
    fetchPayrollReports();
  }, [fetchPayrollReports]);

  useEffect(() => {
    if (usesPeriodAggregateView(periodMode) && payrollReports.length > 0) {
      setSelectedRunId(PERIOD_AGGREGATE_ID);
    }
  }, [periodMode, periodLabel, payrollReports.length]);

  const filteredReports = useMemo(() => {
    if (!search.trim()) return payrollReports;
    const q = search.trim().toLowerCase();
    return payrollReports.filter((report) => {
      const period = `${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`;
      return (
        formatDate(report.payDate).toLowerCase().includes(q) ||
        period.toLowerCase().includes(q) ||
        String(report.checkNumberStart || '').toLowerCase().includes(q)
      );
    });
  }, [payrollReports, search]);

  const periodReport = useMemo(
    () => buildAggregatedPeriodReport(filteredReports, periodLabel, dateRange),
    [filteredReports, periodLabel, dateRange]
  );

  const selectedReport = useMemo(() => {
    if (selectedRunId === PERIOD_AGGREGATE_ID) return periodReport;
    return payrollReports.find((r) => r.id === selectedRunId) ?? null;
  }, [payrollReports, selectedRunId, periodReport]);

  const isViewingPeriodReport = selectedRunId === PERIOD_AGGREGATE_ID;

  const filteredEmployees = useMemo(() => {
    if (!selectedReport?.employees) return [];
    if (!employeeSearch.trim()) return selectedReport.employees;
    const q = employeeSearch.trim().toLowerCase();
    return selectedReport.employees.filter((emp) =>
      [emp.employeeName, emp.position, emp.payType, emp.checkNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [selectedReport, employeeSearch]);

  const rangeTotals = useMemo(() => {
    return filteredReports.reduce(
      (acc, r) => {
        acc.runs += 1;
        acc.employees += r.employeeCount || 0;
        acc.gross += r.totalGross || 0;
        acc.taxes += r.totalTaxes || 0;
        acc.deductions += r.totalDeductions || 0;
        acc.net += r.totalNet || 0;
        return acc;
      },
      { runs: 0, employees: 0, gross: 0, taxes: 0, deductions: 0, net: 0 }
    );
  }, [filteredReports]);

  const employeeTotals = useMemo(() => {
    return filteredEmployees.reduce(
      (acc, emp) => {
        acc.gross += emp.grossPay || 0;
        acc.taxes += emp.totalTaxes || emp.taxes?.totalTaxes || 0;
        acc.deductions += emp.totalDeductions || 0;
        acc.net += emp.netPay || 0;
        return acc;
      },
      { gross: 0, taxes: 0, deductions: 0, net: 0 }
    );
  }, [filteredEmployees]);

  const runPayslipAction = async (payrollRunId, employee, action) => {
    const loadingKey = `${payrollRunId}-${employee.employeeId}`;
    setPayslipLoading((prev) => ({ ...prev, [loadingKey]: action }));

    try {
      const params = { apiUrl: API_URL, token, payrollRunId, employeeId: employee.employeeId };

      if (action === 'view') {
        await viewPayslipPdf(params);
      } else if (action === 'download') {
        await downloadPayslipPdf(params);
        toast.success('Payslip downloaded!');
      } else {
        await sendPayslipEmail(params);
        toast.success(`Payslip sent to ${employee.employeeName}`);
      }
    } catch (error) {
      console.error('Payslip action error:', error);
      toast.error(error.message || 'Payslip action failed');
    } finally {
      setPayslipLoading((prev) => ({ ...prev, [loadingKey]: null }));
    }
  };

  const handlePrintCheck = async (payrollRunId, employeeId) => {
    if (isMockPayrollId(payrollRunId)) {
      toast.info('Check printing is not available for demo payroll runs.');
      return;
    }
    try {
      toast.info('Generating check for printing...');
      const response = await fetch(
        `${API_URL}/api/payroll-system/generate-check-pdf/${payrollRunId}/${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to generate check');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      printWindow?.addEventListener('load', () => printWindow.print());
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success('Check ready for printing!');
    } catch (error) {
      console.error('Error generating check:', error);
      toast.error('Failed to generate check');
    }
  };

  const exportPayrollSummary = async () => {
    if (!selectedReport?.employees?.length) {
      toast.error('No payroll data in this report to export');
      return;
    }

    const eligible = filteredEmployees.filter((emp) => emp.grossPay != null);
    if (eligible.length === 0) {
      toast.error('No payroll data to summarize');
      return;
    }

    const periodFrom = isViewingPeriodReport
      ? dateRange.from
      : selectedReport.periodStart?.split('T')[0] || dateRange.from;
    const periodTo = isViewingPeriodReport
      ? dateRange.to
      : selectedReport.periodEnd?.split('T')[0] || dateRange.to;

    try {
      const [settingsRes, futaRes] = await Promise.all([
        fetch(`${API_URL}/api/company-information/company-settings`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/deductions/settings`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
      ]);

      const settingsData = await settingsRes.json();
      const futaData = await futaRes.json();

      const companyName = settingsRes.ok && settingsData.success
        ? settingsData.data?.company?.name || 'Company'
        : 'Company';
      const futaEnabled = futaRes.ok && futaData.success
        ? Boolean(futaData.data?.futaEnabled)
        : false;

      const filename = await downloadPayrollSummaryExcel({
        companyName,
        dateFrom: periodFrom,
        dateTo: periodTo,
        employees: eligible.map(mapReportEmployeeToSummaryRow),
        futaEnabled,
      });
      toast.success(
        `${isViewingPeriodReport ? 'Period' : 'Payroll'} summary exported (${eligible.length} employees) — ${filename}`
      );
    } catch (error) {
      console.error('Error exporting payroll summary:', error);
      toast.error(error.message || 'Failed to export payroll summary');
    }
  };

  const reportTabs = [
    { id: 'payroll-detail', label: 'Payroll Detail', enabled: true },
    { id: '941-tax', label: '941 Tax Liability', enabled: false },
    { id: 'de-9c', label: 'DE-9C', enabled: false },
  ];

  const renderPayrollDetailTab = () => (
    <div className="p-3 sm:p-6 space-y-4">
      {/* Report period filter */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3">
          Report Period
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-blue-700 mb-1">Period type</label>
            <select
              value={periodMode}
              onChange={(e) => handlePeriodModeChange(e.target.value)}
              className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[150px]"
            >
              {PERIOD_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          {periodMode !== 'custom' && (
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[100px]"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === 'quarterly' && (
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Quarter</label>
              <select
                value={selectedQuarter}
                onChange={(e) => handleQuarterChange(Number(e.target.value))}
                className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[160px]"
              >
                {QUARTER_OPTIONS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === 'monthly' && (
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[140px]"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">From</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                  className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">To</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                  className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-blue-700 mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[140px]"
            >
              <option value="Pay Date">Pay Date</option>
              <option value="Amount">Net Pay Amount</option>
            </select>
          </div>
          <button
            onClick={fetchPayrollReports}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
        {periodMode !== 'custom' && (
          <p className="mt-2 text-xs text-blue-600">
            Date range: <span className="font-medium">{dateRange.from}</span> to{' '}
            <span className="font-medium">{dateRange.to}</span>
          </p>
        )}
        {!loading && payrollReports.length > 0 && (
          <p className="mt-2 text-xs text-blue-700">
            Showing {filteredReports.length} payroll run{filteredReports.length !== 1 ? 's' : ''} for{' '}
            <span className="font-medium">{periodLabel}</span> ({dateRange.from} to {dateRange.to})
          </p>
        )}
      </div>

      <MockPayrollBanner showingMock={usingMockData} />

      {/* Period report summary */}
      {!loading && filteredReports.length > 0 && isViewingPeriodReport && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-orange-900">
                {periodLabel} Payroll Report
              </p>
              <p className="text-xs text-orange-800 mt-0.5">
                {periodReport.runsIncluded} payroll run{periodReport.runsIncluded !== 1 ? 's' : ''} combined ·{' '}
                {periodReport.employeeCount} unique employee{periodReport.employeeCount !== 1 ? 's' : ''} ·{' '}
                {dateRange.from} to {dateRange.to}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={exportPayrollSummary}
                disabled={periodReport.employees.length === 0}
                className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                Export {periodLabel} Report
              </button>
              <div className="text-right">
                <p className="text-xs text-orange-800 uppercase tracking-wide">Period Net Payroll</p>
                <p className="text-2xl font-bold text-orange-900">{formatCurrency(periodReport.totalNet)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Runs summary banner */}
      {!loading && filteredReports.length > 0 && !isViewingPeriodReport && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-green-800">Saved payroll runs in range</p>
              <p className="text-xs text-green-700 mt-0.5">
                {rangeTotals.runs} run{rangeTotals.runs !== 1 ? 's' : ''} ·{' '}
                {rangeTotals.employees} employee record{rangeTotals.employees !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-700 uppercase tracking-wide">Total Net Payroll</p>
              <p className="text-2xl font-bold text-green-800">{formatCurrency(rangeTotals.net)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search runs by date or period..."
          className="w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <span className="text-sm text-gray-500">
          {filteredReports.length} of {payrollReports.length} runs
        </span>
        {!loading && filteredReports.length > 0 && (
          <span className="text-sm font-medium text-orange-700">
            Σ {formatCurrency(rangeTotals.gross)} gross
          </span>
        )}
      </div>

      {/* Payroll runs spreadsheet */}
      <div className="border border-gray-400 rounded-lg overflow-hidden shadow-sm bg-white">
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-300">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {usesPeriodAggregateView(periodMode)
              ? 'Report views — period summary or individual payroll runs'
              : 'Payroll Runs — select a row to view employees below'}
          </p>
        </div>
        <div className="overflow-auto max-h-[280px]">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
              <span className="text-gray-600 text-sm">Loading payroll reports...</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">
              No saved payroll runs found for this period. Save payroll from the Employee Sheet first.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#f3f3f3]">
                  {['View', 'Pay Date', 'Period', 'Employees', 'Gross Pay', 'Taxes', 'Deductions', 'Net Pay'].map(
                    (label, i) => (
                      <th
                        key={label}
                        className={`px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 whitespace-nowrap ${
                          i <= 1 ? 'text-left' : 'text-right'
                        } ${label === 'Net Pay' ? 'bg-orange-100 text-orange-800' : ''} ${
                          label === 'Gross Pay' ? 'bg-green-100 text-green-800' : ''
                        } ${label === 'Taxes' ? 'bg-blue-100 text-blue-800' : ''} ${
                          label === 'Deductions' ? 'bg-red-100 text-red-800' : ''
                        } ${label === 'View' ? 'bg-orange-50 text-orange-800 min-w-[140px]' : ''}`}
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {usesPeriodAggregateView(periodMode) && (
                  <tr
                    onClick={() => setSelectedRunId(PERIOD_AGGREGATE_ID)}
                    className={`cursor-pointer transition-colors ${
                      isViewingPeriodReport
                        ? 'bg-orange-50 ring-1 ring-inset ring-orange-300'
                        : 'bg-orange-50/40 hover:bg-orange-50'
                    }`}
                  >
                    <td className="px-3 py-2 border border-gray-300 font-semibold text-orange-800 text-xs">
                      {periodLabel} Summary
                    </td>
                    <td className="px-3 py-2 border border-gray-300 text-gray-500 text-xs">
                      All runs
                    </td>
                    <td className="px-3 py-2 border border-gray-300 text-right text-gray-700 text-xs whitespace-nowrap">
                      {formatDate(dateRange.from)} – {formatDate(dateRange.to)}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs">
                      {periodReport.employeeCount}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs text-green-700">
                      {formatCurrency(periodReport.totalGross)}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs text-blue-700">
                      {formatCurrency(periodReport.totalTaxes)}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs text-red-700">
                      {formatCurrency(periodReport.totalDeductions)}
                    </td>
                    <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs font-semibold text-orange-700">
                      {formatCurrency(periodReport.totalNet)}
                    </td>
                  </tr>
                )}
                {filteredReports.map((report, index) => {
                  const isSelected = report.id === selectedRunId;
                  return (
                    <tr
                      key={report.id}
                      onClick={() => setSelectedRunId(report.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-orange-50 ring-1 ring-inset ring-orange-300'
                          : index % 2 === 0
                            ? 'bg-white hover:bg-gray-50'
                            : 'bg-[#fafafa] hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-2 border border-gray-300 text-xs text-gray-600">
                        Single run
                      </td>
                      <td className="px-3 py-2 border border-gray-300 font-medium text-gray-900">
                        {formatDate(report.payDate)}
                        {report.isMock && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            DEMO
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border border-gray-300 text-right text-gray-700 text-xs whitespace-nowrap">
                        {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
                      </td>
                      <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs">
                        {report.employeeCount}
                      </td>
                      <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs text-green-700">
                        {formatCurrency(report.totalGross)}
                      </td>
                      <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs text-blue-700">
                        {formatCurrency(report.totalTaxes)}
                      </td>
                      <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs text-red-700">
                        {formatCurrency(report.totalDeductions)}
                      </td>
                      <td className="px-3 py-2 border border-gray-300 text-right font-mono text-xs font-semibold text-orange-700">
                        {formatCurrency(report.totalNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Employee detail spreadsheet */}
      {selectedReport && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {isViewingPeriodReport
                  ? `Employees — ${periodLabel} (${periodReport.runsIncluded} runs combined)`
                  : `Employees — Pay date ${formatDate(selectedReport.payDate)}`}
              </p>
              <p className="text-xs text-gray-500">
                Period {formatDate(selectedReport.periodStart)} to {formatDate(selectedReport.periodEnd)}
                {isViewingPeriodReport && ' · Totals summed per employee across all runs in range'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto min-w-0">
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search employees..."
                className="w-full sm:w-56 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={exportPayrollSummary}
                disabled={filteredEmployees.length === 0}
                className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                {isViewingPeriodReport ? `Export ${periodLabel} Report` : 'Payroll Summary'}
              </button>
            </div>
          </div>

          <div className="border border-gray-400 rounded-lg overflow-hidden shadow-sm bg-white">
            <div className="overflow-auto max-h-[calc(100vh-520px)]">
              <table className="w-full border-collapse text-sm min-w-[1100px]">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#f3f3f3]">
                    <th
                      className={`sm:sticky ${STICKY_ROW_NUM_LEFT} z-40 min-w-[48px] px-2 py-2 text-center text-xs font-semibold text-gray-600 border border-gray-300 bg-[#e8e8e8]`}
                    >
                      #
                    </th>
                    <th
                      className={`sm:sticky ${STICKY_NAME_LEFT} z-30 min-w-[160px] px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 bg-[#f3f3f3] text-left`}
                    >
                      Name
                    </th>
                    {[
                      { key: 'position', label: 'Position', align: 'left' },
                      { key: 'payType', label: 'Pay Type', align: 'center' },
                      { key: 'check', label: 'Check #', align: 'right' },
                      { key: 'gross', label: 'Gross Pay', align: 'right', highlight: 'green' },
                      { key: 'taxes', label: 'Taxes', align: 'right', highlight: 'blue' },
                      { key: 'deductions', label: 'Deductions', align: 'right', highlight: 'red' },
                      { key: 'net', label: 'Net Pay', align: 'right', highlight: 'orange' },
                      ...(isViewingPeriodReport
                        ? []
                        : [{ key: 'actions', label: 'Payslip', align: 'center', sticky: true }]),
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`px-3 py-2 text-xs font-semibold border border-gray-300 whitespace-nowrap ${
                          col.highlight === 'green' ? 'bg-green-100 text-green-800' : ''
                        } ${col.highlight === 'blue' ? 'bg-blue-100 text-blue-800' : ''
                        } ${col.highlight === 'red' ? 'bg-red-100 text-red-800' : ''
                        } ${col.highlight === 'orange' ? 'bg-orange-100 text-orange-800' : ''
                        } ${col.sticky ? 'sm:sticky right-0 z-30 bg-violet-50 text-violet-800 min-w-[140px]' : 'bg-[#f3f3f3] text-gray-700'}`}
                        style={{ textAlign: col.align }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={isViewingPeriodReport ? 9 : 10} className="px-4 py-12 text-center text-gray-500 border border-gray-300">
                        No employees match your search
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp, index) => (
                      <tr
                        key={`${emp.employeeId}-${index}`}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}
                      >
                        <td
                          className={`sm:sticky ${STICKY_ROW_NUM_LEFT} z-20 px-2 py-1.5 text-center text-xs font-mono text-gray-500 border border-gray-300 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
                          }`}
                        >
                          {index + 1}
                        </td>
                        <td
                          className={`sm:sticky ${STICKY_NAME_LEFT} z-10 px-3 py-1.5 text-sm font-medium text-gray-900 border border-gray-300 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
                          }`}
                        >
                          {emp.employeeName || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300">
                          {emp.position || '—'}
                        </td>
                        <td className="px-3 py-1.5 border border-gray-300 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              emp.payType === 'salary'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {emp.payType?.toUpperCase() || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-xs font-mono text-gray-700 border border-gray-300 text-right">
                          {emp.checkNumber || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-xs font-mono text-green-700 border border-gray-300 text-right">
                          {formatCurrency(emp.grossPay)}
                        </td>
                        <td className="px-3 py-1.5 text-xs font-mono text-blue-700 border border-gray-300 text-right">
                          {formatCurrency(emp.totalTaxes || emp.taxes?.totalTaxes)}
                        </td>
                        <td className="px-3 py-1.5 text-xs font-mono text-red-700 border border-gray-300 text-right">
                          {formatCurrency(emp.totalDeductions)}
                        </td>
                        <td className="px-3 py-1.5 text-xs font-mono font-semibold text-orange-700 bg-orange-50/40 border border-gray-300 text-right">
                          {formatCurrency(emp.netPay)}
                        </td>
                        {!isViewingPeriodReport && (
                          <td className="sm:sticky right-0 z-10 px-2 py-1.5 border border-gray-300 text-center bg-inherit">
                            <div className="inline-flex items-center gap-1">
                              <PayslipActionButtons
                                disabled={selectedReport.isMock}
                                loadingAction={payslipLoading[`${selectedReport.id}-${emp.employeeId}`]}
                                onView={() => runPayslipAction(selectedReport.id, emp, 'view')}
                                onDownload={() => runPayslipAction(selectedReport.id, emp, 'download')}
                                onSend={() => runPayslipAction(selectedReport.id, emp, 'send')}
                              />
                              <button
                                type="button"
                                onClick={() => handlePrintCheck(selectedReport.id, emp.employeeId)}
                                disabled={selectedReport.isMock}
                                title={selectedReport.isMock ? 'Not available for demo data' : 'Print check'}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredEmployees.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-gray-200">
                    <tr>
                      <td
                        className={`sm:sticky ${STICKY_ROW_NUM_LEFT} z-30 px-2 py-2 text-xs font-bold text-gray-700 border border-gray-300 text-center bg-gray-200`}
                      >
                        Σ
                      </td>
                      <td
                        className={`sm:sticky ${STICKY_NAME_LEFT} z-20 px-3 py-2 text-xs font-bold text-gray-800 border border-gray-300 bg-gray-200`}
                      >
                        Totals
                      </td>
                      <td colSpan={3} className="border border-gray-300 bg-gray-200" />
                      <td className="px-3 py-2 text-xs font-bold font-mono text-green-800 border border-gray-300 text-right">
                        {formatCurrency(employeeTotals.gross)}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold font-mono text-blue-800 border border-gray-300 text-right">
                        {formatCurrency(employeeTotals.taxes)}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold font-mono text-red-800 border border-gray-300 text-right">
                        {formatCurrency(employeeTotals.deductions)}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold font-mono text-orange-800 border border-gray-300 text-right">
                        {formatCurrency(employeeTotals.net)}
                      </td>
                      {!isViewingPeriodReport && (
                        <td className="sm:sticky right-0 z-20 border border-gray-300 bg-gray-200" />
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-gray-500">
        {usesPeriodAggregateView(periodMode)
          ? `Quarterly, monthly, and yearly views build a combined period report across all saved runs in the date range. Use Export to download the full period summary.`
          : `Custom range reports show saved payroll runs — select a run to view employees or export a single-run summary.`}
      </p>
    </div>
  );

  return (
    <>
      <Toaster position="top-center" richColors />
      <div>
        <div className="bg-gray-50 border-b">
          <div className="px-4 sm:px-6 pt-4 overflow-x-auto">
            <nav className="flex space-x-2 w-max min-w-full">
              {reportTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => tab.enabled && setActiveReportTab(tab.id)}
                  disabled={!tab.enabled}
                  className={`px-4 sm:px-6 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    activeReportTab === tab.id
                      ? 'bg-orange-500 text-white'
                      : tab.enabled
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
        {renderPayrollDetailTab()}
      </div>
    </>
  );
};

export default Reports;
