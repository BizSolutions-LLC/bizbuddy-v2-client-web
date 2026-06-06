'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import useAuthStore from '@/store/useAuthStore';
import { computeEmployeePayroll, DEFAULT_TAX_RATES } from '@/lib/payrollCompute';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const BASE_COLUMNS = [
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'email', label: 'Email', align: 'left' },
  { key: 'employeeId', label: 'Employee ID', align: 'left' },
  { key: 'departmentName', label: 'Department', align: 'left' },
  { key: 'position', label: 'Position', align: 'left' },
  { key: 'status', label: 'Status', align: 'center' },
  { key: 'payRate', label: 'Pay Rate', align: 'right' },
  { key: 'hourlyRate', label: 'Legacy Rate', align: 'right' },
];

const PAY_TYPE_COLUMN = { key: 'payType', label: 'Pay Type', align: 'center' };

const HOURS_COLUMNS = [
  { key: 'regularHours', label: 'Regular Hrs', align: 'right' },
  { key: 'overtimeHours', label: 'OT Hrs', align: 'right' },
  { key: 'totalPunchHours', label: 'Total Punch Hrs', align: 'right' },
  { key: 'rawClockedHours', label: 'Raw Clocked', align: 'right' },
  { key: 'daysWorked', label: 'Days Worked', align: 'center' },
];

const SALARY_COLUMNS = [
  { key: 'grossPay', label: 'Gross Pay', align: 'right' },
  { key: 'taxes', label: 'Taxes', align: 'right' },
  { key: 'deductions', label: 'Deductions', align: 'right' },
  { key: 'netPay', label: 'Net Pay', align: 'right' },
];

function getDefaultDateRange() {
  const today = new Date();
  const payTo = new Date(today);
  const payFrom = new Date(today);
  payFrom.setDate(payFrom.getDate() - 13);
  return {
    from: payFrom.toLocaleDateString('en-CA'),
    to: payTo.toLocaleDateString('en-CA'),
  };
}

function formatPayRate(payType, payRate) {
  if (!payRate || parseFloat(payRate) <= 0) return '—';
  const num = parseFloat(payRate);
  if (payType === 'salary') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num) + '/hr';
}

function formatHours(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(2);
}

function formatLegacyRate(rate) {
  if (!rate || parseFloat(rate) <= 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(rate)) + '/hr';
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(rate) {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 2)}%`;
}

function TaxColumnInfo() {
  const { federalRate, stateRate, ficaRate, medicareRate, sdiRate, ficaWageBase } = DEFAULT_TAX_RATES;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full text-blue-600 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="How taxes are calculated"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-sm bg-gray-900 text-gray-100 border border-gray-700 p-3 text-left leading-relaxed"
        >
          <p className="font-semibold text-white mb-2">Taxes column</p>
          <p className="mb-2">
            Estimated withholdings on each employee&apos;s <strong>gross pay</strong> for this period
            (same rates as Create Paycheck):
          </p>
          <ul className="list-disc pl-4 space-y-1 mb-2">
            <li>Federal income tax: {formatPercent(federalRate)} of gross</li>
            <li>State income tax: {formatPercent(stateRate)} of gross</li>
            <li>
              FICA (Social Security): {formatPercent(ficaRate)} of gross
              {` (capped at $${ficaWageBase.toLocaleString()} per calc)`}
            </li>
            <li>Medicare: {formatPercent(medicareRate)} of gross</li>
            <li>CA SDI: {formatPercent(sdiRate)} of gross</li>
            <li>CalSavers: 5% of gross if enabled on the employee profile</li>
            <li>Plus any additional federal/state amounts on the employee profile</li>
          </ul>
          <p className="text-gray-300 text-[11px]">
            FICA &amp; Medicare are skipped when &quot;Skip FICA/Medicare&quot; is enabled.
            Deductions are $0 on this sheet. Net Pay = Gross − Taxes − Deductions.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatCutoffLabel(period) {
  const start = new Date(period.periodStart).toLocaleDateString();
  const end = new Date(period.periodEnd).toLocaleDateString();
  const dept = period.department?.name ? ` · ${period.department.name}` : '';
  return `${start} – ${end} (${period.status})${dept}`;
}

const EmployeeSheet = () => {
  const { token } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursLoaded, setHoursLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [cutoffPeriods, setCutoffPeriods] = useState([]);
  const [salaryComputed, setSalaryComputed] = useState(false);
  const [salaryComputing, setSalaryComputing] = useState(false);
  const [companyConfig, setCompanyConfig] = useState(null);

  const fetchCutoffPeriods = useCallback(async () => {
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/cutoff-periods?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) return [];

    const seen = new Set();
    return (data.data || [])
      .filter((p) => {
        const key = `${p.periodStart?.slice(0, 10)}|${p.periodEnd?.slice(0, 10)}|${p.departmentId || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart));
  }, [token]);

  const fetchHoursForPeriod = useCallback(async (from, to) => {
    if (!token || !from || !to) return {};

    const res = await fetch(
      `${API_URL}/api/payroll-system/import-clock-hours?from=${from}&to=${to}`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch punch hours');
    }

    const hoursByUserId = {};
    (data.data?.employees || []).forEach((emp) => {
      const regular = emp.regularHours || 0;
      const ot = emp.approvedOvertimeHours || 0;
      hoursByUserId[emp.userId] = {
        regularHours: regular,
        overtimeHours: ot,
        totalPunchHours: +(regular + ot).toFixed(2),
        rawClockedHours: emp.totalRawClockedHours ?? null,
        daysWorked: emp.daysWorked ?? null,
        hasActiveClockIn: emp.hasActiveClockIn || false,
        payType: emp.payType || null,
        payRate: emp.payRate ?? null,
      };
    });

    return hoursByUserId;
  }, [token]);

  const mergeHoursIntoRows = useCallback((employeeRows, hoursByUserId) => {
    return employeeRows.map((row) => {
      const hours = hoursByUserId[row.id];
      return {
        ...row,
        regularHours: hours?.regularHours ?? null,
        overtimeHours: hours?.overtimeHours ?? null,
        totalPunchHours: hours?.totalPunchHours ?? null,
        rawClockedHours: hours?.rawClockedHours ?? null,
        daysWorked: hours?.daysWorked ?? null,
        hasActiveClockIn: hours?.hasActiveClockIn ?? false,
        payType: hours?.payType ?? row.payType,
        payRate: hours?.payRate ?? row.payRate,
      };
    });
  }, []);

  const clearHoursFromRows = useCallback((employeeRows) => {
    return employeeRows.map((row) => ({
      ...row,
      regularHours: null,
      overtimeHours: null,
      totalPunchHours: null,
      rawClockedHours: null,
      daysWorked: null,
      hasActiveClockIn: false,
    }));
  }, []);

  const clearSalaryFromRows = useCallback((employeeRows) => {
    return employeeRows.map((row) => ({
      ...row,
      grossPay: null,
      taxes: null,
      deductions: null,
      netPay: null,
      computeError: null,
    }));
  }, []);

  const fetchEmployees = useCallback(async () => {
    const [listRes, detailsRes] = await Promise.all([
      fetch(`${API_URL}/api/payroll-system/get-employees-list`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
      fetch(`${API_URL}/api/employee-payroll-details/employees-with-details`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }),
    ]);

    const listData = await listRes.json();
    const detailsData = await detailsRes.json();

    if (!listRes.ok) {
      throw new Error(listData.message || 'Failed to fetch employees');
    }

    const detailById = {};
    if (detailsRes.ok && detailsData.success) {
      (detailsData.data.employees || []).forEach((emp) => {
        detailById[emp.id] = emp;
      });
    }

    return (listData.data?.employees || []).map((emp) => {
      const detail = detailById[emp.id];
      const payroll = detail?.payrollDetails;
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email || '—',
        employeeId: emp.employeeId || '—',
        departmentName: emp.departmentName || '—',
        position: emp.position || '—',
        status: emp.status,
        payType: payroll?.payType || '—',
        payRate: payroll?.payRate ?? null,
        payrollDetails: payroll || null,
        earningRates: detail?.earningRates || {},
        hourlyRate: emp.hourlyRate,
        regularHours: null,
        overtimeHours: null,
        totalPunchHours: null,
        rawClockedHours: null,
        daysWorked: null,
        hasActiveClockIn: false,
        grossPay: null,
        taxes: null,
        deductions: null,
        netPay: null,
        computeError: null,
      };
    });
  }, [token]);

  const loadHours = useCallback(async (from, to, currentRows) => {
    if (!from || !to) {
      toast.error('Please select both From and To dates');
      return;
    }

    if (new Date(from) > new Date(to)) {
      toast.error('From date must be before or equal to To date');
      return;
    }

    try {
      setHoursLoading(true);
      const hoursByUserId = await fetchHoursForPeriod(from, to);
      setRows(mergeHoursIntoRows(currentRows, hoursByUserId));
      setHoursLoaded(true);
      toast.success(`Hours loaded for ${from} to ${to}`);
    } catch (err) {
      toast.error(err.message || 'Failed to load punch hours');
      setHoursLoaded(false);
    } finally {
      setHoursLoading(false);
    }
  }, [fetchHoursForPeriod, mergeHoursIntoRows]);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        setLoading(true);
        const [employeeRows, periods] = await Promise.all([
          fetchEmployees(),
          fetchCutoffPeriods(),
        ]);
        setCutoffPeriods(periods);
        setRows(employeeRows);

        const { from, to } = getDefaultDateRange();
        await loadHours(from, to, employeeRows);
      } catch (err) {
        toast.error(err.message || 'Failed to initialize sheet');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleLoadHours = async () => {
    const baseRows = clearSalaryFromRows(clearHoursFromRows(rows));
    setRows(baseRows);
    setHoursLoaded(false);
    setSalaryComputed(false);
    await loadHours(dateRange.from, dateRange.to, baseRows);
  };

  const handleComputeSalary = async () => {
    if (!hoursLoaded) {
      toast.warning('Load hours first — hourly employees need punch data for this period.');
    }

    try {
      setSalaryComputing(true);

      const [detailsRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/employee-payroll-details/employees-with-details`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/company-information/company-settings`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
      ]);

      const detailsData = await detailsRes.json();
      const settingsData = await settingsRes.json();

      if (!detailsRes.ok || !detailsData.success) {
        throw new Error(detailsData.message || 'Failed to fetch employee payroll details');
      }
      if (!settingsRes.ok || !settingsData.success) {
        throw new Error(settingsData.message || 'Failed to fetch company settings');
      }

      const { employees: payrollEmployees, earningTypes } = detailsData.data;
      const { company, payrollConfig } = settingsData.data;
      const payFrequency = payrollConfig?.payFrequency || 'biweekly';

      setCompanyConfig({
        companyName: company?.name || 'Company',
        payFrequency,
      });

      const detailById = {};
      payrollEmployees.forEach((emp) => {
        detailById[emp.id] = emp;
      });

      let computedCount = 0;
      let skippedCount = 0;

      setRows((prev) =>
        prev.map((row) => {
          const detail = detailById[row.id];
          if (!detail?.payrollDetails) {
            skippedCount++;
            return {
              ...row,
              grossPay: null,
              taxes: null,
              deductions: null,
              netPay: null,
              computeError: 'no_profile',
            };
          }

          const employee = {
            payrollDetails: detail.payrollDetails,
            earningRates: detail.earningRates || {},
          };

          const result = computeEmployeePayroll({
            employee,
            earningTypes,
            hours: {
              regularHours: row.regularHours ?? 0,
              overtimeHours: row.overtimeHours ?? 0,
            },
            payFrequency,
          });

          if (result.error) {
            skippedCount++;
          } else {
            computedCount++;
          }

          return {
            ...row,
            payrollDetails: detail.payrollDetails,
            earningRates: detail.earningRates || {},
            payType: detail.payrollDetails.payType,
            payRate: detail.payrollDetails.payRate,
            grossPay: result.grossPay,
            taxes: result.taxes,
            deductions: result.deductions,
            netPay: result.netPay,
            computeError: result.error,
          };
        })
      );

      setSalaryComputed(true);
      toast.success(
        `Computed ${computedCount} employee(s) using ${payFrequency} pay frequency` +
          (skippedCount > 0 ? ` (${skippedCount} skipped)` : '')
      );
    } catch (err) {
      toast.error(err.message || 'Failed to compute salary');
      console.error(err);
    } finally {
      setSalaryComputing(false);
    }
  };

  const handleQuickFillCutoff = (cutoffId) => {
    if (!cutoffId) return;
    const period = cutoffPeriods.find((p) => p.id === cutoffId);
    if (!period) return;
    setDateRange({
      from: period.periodStart.slice(0, 10),
      to: period.periodEnd.slice(0, 10),
    });
  };

  const handleRefresh = async () => {
    const shouldRecompute = salaryComputed;
    try {
      setLoading(true);
      setSalaryComputed(false);
      const employeeRows = await fetchEmployees();
      await loadHours(dateRange.from, dateRange.to, employeeRows);
      toast.success('Sheet refreshed');
      if (shouldRecompute) {
        await handleComputeSalary();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  };

  const sheetColumns = useMemo(() => {
    const cols = [...BASE_COLUMNS];
    if (hoursLoaded) cols.push(...HOURS_COLUMNS);
    cols.push(PAY_TYPE_COLUMN);
    if (salaryComputed) cols.push(...SALARY_COLUMNS);
    return cols;
  }, [hoursLoaded, salaryComputed]);

  const filteredRows = useMemo(() => {
    let result = rows;

    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status.toLowerCase() === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) =>
        [r.name, r.email, r.employeeId, r.departmentName, r.position, r.status, r.payType]
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    return result;
  }, [rows, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { all: rows.length, active: 0, inactive: 0, deleted: 0 };
    rows.forEach((r) => {
      const key = r.status.toLowerCase();
      if (counts[key] !== undefined) counts[key]++;
    });
    return counts;
  }, [rows]);

  const hoursTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        if (row.totalPunchHours != null) acc.totalPunch += row.totalPunchHours;
        if (row.regularHours != null) acc.regular += row.regularHours;
        if (row.overtimeHours != null) acc.ot += row.overtimeHours;
        return acc;
      },
      { totalPunch: 0, regular: 0, ot: 0 }
    );
  }, [filteredRows]);

  const salaryTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        if (row.grossPay != null) acc.gross += row.grossPay;
        if (row.taxes != null) acc.taxes += row.taxes;
        if (row.deductions != null) acc.deductions += row.deductions;
        if (row.netPay != null) acc.net += row.netPay;
        return acc;
      },
      { gross: 0, taxes: 0, deductions: 0, net: 0 }
    );
  }, [filteredRows]);

  const exportToExcel = () => {
    if (filteredRows.length === 0) {
      toast.error('No rows to export');
      return;
    }

    const exportData = filteredRows.map((row, index) => {
      const base = {
        '#': index + 1,
        Name: row.name,
        Email: row.email,
        'Employee ID': row.employeeId,
        Department: row.departmentName,
        Position: row.position,
        Status: row.status,
        'Pay Rate': formatPayRate(row.payType, row.payRate),
      };

      if (hoursLoaded) {
        base['Regular Hrs'] = formatHours(row.regularHours);
        base['OT Hrs'] = formatHours(row.overtimeHours);
        base['Total Punch Hrs'] = formatHours(row.totalPunchHours);
        base['Raw Clocked'] = formatHours(row.rawClockedHours);
        base['Days Worked'] = row.daysWorked ?? '—';
      }

      base['Pay Type'] =
        row.payType === '—' || !row.payType ? '—' : row.payType.toUpperCase();

      if (salaryComputed) {
        base['Gross Pay'] = formatCurrency(row.grossPay);
        base['Taxes'] = formatCurrency(row.taxes);
        base['Deductions'] = formatCurrency(row.deductions);
        base['Net Pay'] = formatCurrency(row.netPay);
      }

      return base;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    XLSX.writeFile(workbook, `company-employees-${dateRange.from}_to_${dateRange.to}.xlsx`);
    toast.success(`Exported ${filteredRows.length} employees`);
  };

  const cellValue = (row, key) => {
    switch (key) {
      case 'payRate':
        return formatPayRate(row.payType, row.payRate);
      case 'hourlyRate':
        return formatLegacyRate(row.hourlyRate);
      case 'payType':
        return row.payType === '—' ? '—' : row.payType.toUpperCase();
      case 'regularHours':
      case 'overtimeHours':
      case 'totalPunchHours':
      case 'rawClockedHours':
        return formatHours(row[key]);
      case 'daysWorked':
        return row.daysWorked ?? '—';
      case 'grossPay':
      case 'taxes':
      case 'deductions':
      case 'netPay':
        if (row.computeError === 'no_pay_rate') return 'No rate';
        if (row.computeError === 'no_profile') return '—';
        return formatCurrency(row[key]);
      default:
        return row[key] ?? '—';
    }
  };

  const statusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      case 'deleted':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
          <span className="text-gray-600">Loading employee sheet...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="p-6">
        {/* Date range selector */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3">
            Cutoff Period (Date Range)
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">From</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, from: e.target.value }));
                  setHoursLoaded(false);
                  setSalaryComputed(false);
                }}
                className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">To</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, to: e.target.value }));
                  setHoursLoaded(false);
                  setSalaryComputed(false);
                }}
                className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleLoadHours}
              disabled={hoursLoading || !dateRange.from || !dateRange.to}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hoursLoading ? 'Loading...' : 'Load Hours'}
            </button>
            {cutoffPeriods.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">Quick fill</label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    handleQuickFillCutoff(e.target.value);
                    e.target.value = '';
                  }}
                  className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[220px]"
                >
                  <option value="" disabled>From saved cutoff...</option>
                  {cutoffPeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {formatCutoffLabel(period)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {hoursLoaded && !hoursLoading && (
            <p className="mt-2 text-xs text-blue-700">
              Showing punch hours for {dateRange.from} to {dateRange.to}
            </p>
          )}
        </div>

        {salaryComputed && companyConfig && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-800">
                  Payroll computed — {companyConfig.companyName}
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  Pay frequency: <span className="font-medium capitalize">{companyConfig.payFrequency}</span>
                  {' · '}
                  Salary employees: annual pay ÷ periods per year
                  {' · '}
                  Hourly employees: rate × loaded punch hours
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-700 uppercase tracking-wide">Total Net Payroll</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(salaryTotals.net)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All ({statusCounts.all})</option>
              <option value="active">Active ({statusCounts.active})</option>
              <option value="inactive">Inactive ({statusCounts.inactive})</option>
              <option value="deleted">Deleted ({statusCounts.deleted})</option>
            </select>
            <span className="text-sm text-gray-500">
              {filteredRows.length} of {rows.length} rows
            </span>
            {hoursLoaded && !hoursLoading && (
              <span className="text-sm font-medium text-green-700">
                Σ {hoursTotals.totalPunch.toFixed(2)} total punch hrs
              </span>
            )}
            {salaryComputed && !salaryComputing && (
              <span className="text-sm font-medium text-orange-700">
                Σ {formatCurrency(salaryTotals.gross)} gross
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleComputeSalary}
              disabled={salaryComputing || loading}
              className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salaryComputing ? 'Computing...' : 'Compute Salary'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading || hoursLoading || salaryComputing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={exportToExcel}
              disabled={filteredRows.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export Excel
            </button>
          </div>
        </div>

        {/* Spreadsheet */}
        <div className="border border-gray-400 rounded-lg overflow-hidden shadow-sm bg-white">
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full border-collapse text-sm min-w-[1300px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#f3f3f3]">
                  <th className="sticky left-0 z-30 min-w-[48px] px-2 py-2 text-center text-xs font-semibold text-gray-600 border border-gray-300 bg-[#e8e8e8]">
                    #
                  </th>
                  {sheetColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 bg-[#f3f3f3] whitespace-nowrap ${
                        col.key === 'totalPunchHours' ? 'bg-green-100 text-green-800' : ''
                      } ${col.key === 'taxes' ? 'bg-blue-100 text-blue-800' : ''} ${
                        col.key === 'netPay' ? 'bg-orange-100 text-orange-800' : ''
                      }`}
                      style={{ textAlign: col.align }}
                    >
                      {col.key === 'taxes' ? (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                          }`}
                        >
                          {col.label}
                          <TaxColumnInfo />
                        </span>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={sheetColumns.length + 1}
                      className="px-4 py-12 text-center text-gray-500 border border-gray-300"
                    >
                      No employees match your filters
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}
                    >
                      <td className="sticky left-0 z-10 px-2 py-1.5 text-center text-xs font-mono text-gray-500 border border-gray-300 bg-inherit">
                        {index + 1}
                      </td>
                      {sheetColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-1.5 border border-gray-300 whitespace-nowrap ${
                            ['employeeId', 'payRate', 'regularHours', 'overtimeHours', 'totalPunchHours', 'rawClockedHours', 'daysWorked'].includes(col.key)
                              ? 'font-mono text-xs'
                              : 'text-sm'
                          } ${col.key === 'name' ? 'font-medium text-gray-900' : 'text-gray-700'} ${
                            col.key === 'totalPunchHours' && row.totalPunchHours != null ? 'font-semibold text-green-700 bg-green-50/50' : ''
                          } ${col.key === 'netPay' && row.netPay != null ? 'font-semibold text-orange-700 bg-orange-50/50' : ''}`}
                          style={{ textAlign: col.align }}
                        >
                          {col.key === 'status' ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass(row.status)}`}>
                              {row.status}
                            </span>
                          ) : col.key === 'payType' ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                row.payType === 'salary'
                                  ? 'bg-purple-100 text-purple-800'
                                  : row.payType === 'hourly'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {cellValue(row, col.key)}
                            </span>
                          ) : col.key === 'name' && row.hasActiveClockIn ? (
                            <span className="flex items-center gap-1.5">
                              {row.name}
                              <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-700">ACTIVE</span>
                            </span>
                          ) : (hoursLoading && HOURS_COLUMNS.some((h) => h.key === col.key)) ||
                            (salaryComputing && SALARY_COLUMNS.some((s) => s.key === col.key)) ? (
                            <span className="text-gray-300">...</span>
                          ) : (
                            cellValue(row, col.key)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {(hoursLoaded || salaryComputed) && filteredRows.length > 0 && !hoursLoading && !salaryComputing && (
                <tfoot className="sticky bottom-0 z-10 bg-gray-200">
                  <tr>
                    <td className="sticky left-0 z-20 px-2 py-2 text-xs font-bold text-gray-700 border border-gray-300 bg-gray-200 text-center">
                      Σ
                    </td>
                    {sheetColumns.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-xs font-bold text-gray-800 border border-gray-300 font-mono"
                        style={{ textAlign: col.align }}
                      >
                        {col.key === 'regularHours' && formatHours(hoursTotals.regular)}
                        {col.key === 'overtimeHours' && formatHours(hoursTotals.ot)}
                        {col.key === 'totalPunchHours' && formatHours(hoursTotals.totalPunch)}
                        {col.key === 'grossPay' && formatCurrency(salaryTotals.gross)}
                        {col.key === 'taxes' && formatCurrency(salaryTotals.taxes)}
                        {col.key === 'deductions' && formatCurrency(salaryTotals.deductions)}
                        {col.key === 'netPay' && formatCurrency(salaryTotals.net)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          1) Set dates and Load Hours · 2) Compute Salary (uses company pay frequency + earning types from company settings).
          Salary pay is annual amount ÷ periods per year; hourly pay uses loaded punch hours.
        </p>
      </div>
    </>
  );
};

export default EmployeeSheet;
