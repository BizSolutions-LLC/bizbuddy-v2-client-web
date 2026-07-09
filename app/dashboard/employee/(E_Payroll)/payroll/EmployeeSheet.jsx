'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import useAuthStore from '@/store/useAuthStore';
import {
  computeEmployeePayroll,
  calculateDeductionValue,
  calculateTaxes,
  calculateFutaDeduction,
  round2,
  DEFAULT_TAX_RATES,
  DEFAULT_FUTA_WAGE_CAP,
} from '@/lib/payrollCompute';
import {
  viewPayslipPdf,
  downloadPayslipPdf,
  sendPayslipEmail,
  sendAllPayslipEmails,
  isValidEmployeeEmail,
} from '@/lib/payslipActions';
import PayslipActionButtons from '@/components/payroll/PayslipActionButtons';
import ModalPortal from '@/components/ui/modal-portal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Plus, X, Mail, Save } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const STICKY_ROW_NUM_LEFT = 'left-0';
const STICKY_NAME_LEFT = 'left-12'; // matches # column width (48px)

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
  { key: 'deductions', label: 'Total Deductions', align: 'right' },
  { key: 'netPay', label: 'Net Pay', align: 'right' },
];

const TAX_COLUMNS = [
  { key: 'federalTax', label: 'Federal', align: 'right', isTax: true, breakdownKey: 'federalTax' },
  { key: 'stateTax', label: 'State', align: 'right', isTax: true, breakdownKey: 'stateTax' },
  { key: 'fica', label: 'FICA', align: 'right', isTax: true, breakdownKey: 'fica' },
  { key: 'medicare', label: 'Medicare', align: 'right', isTax: true, breakdownKey: 'medicare' },
  { key: 'sdi', label: 'CA SDI', align: 'right', isTax: true, breakdownKey: 'sdi' },
  { key: 'calSavers', label: 'CalSavers', align: 'right', isTax: true, breakdownKey: 'calSavers' },
  { key: 'additionalFed', label: "Add'l Fed", align: 'right', isTax: true, breakdownKey: 'additionalFed' },
  { key: 'additionalState', label: "Add'l State", align: 'right', isTax: true, breakdownKey: 'additionalState' },
];

const TAX_TOTAL_COLUMN = { key: 'taxes', label: 'Tax Total', align: 'right', isTaxTotal: true };

const FUTA_DEDUCTION_COLUMN = { key: 'futaDeduction', label: 'FUTA', align: 'right', isFuta: true };

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

function toLocalDateStr(isoDate, tz = 'UTC') {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-CA', { timeZone: tz });
}

function mapClockHoursEntry(emp) {
  const regular = emp.regularHours || 0;
  const ot = emp.approvedOvertimeHours || 0;
  return {
    regularHours: regular,
    overtimeHours: ot,
    totalPunchHours: +(regular + ot).toFixed(2),
    rawClockedHours: emp.totalRawClockedHours ?? 0,
    daysWorked: emp.daysWorked ?? 0,
    hasActiveClockIn: emp.hasActiveClockIn || false,
    hasPendingOT: emp.hasPendingOT || false,
    pendingOTCount: emp.pendingOTCount || 0,
    payType: emp.payType || null,
    payRate: emp.payRate ?? null,
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
            This amount is included in Total Deductions. Net Pay = Gross − Total Deductions.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FutaColumnInfo({ rate = 7 }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full text-red-600 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="How FUTA is calculated"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-sm bg-gray-900 text-gray-100 border border-gray-700 p-3 text-left leading-relaxed"
        >
          <p className="font-semibold text-white mb-2">FUTA column</p>
          <p className="mb-2 text-sm">
            Federal Unemployment Tax deducted from gross for this pay period when enabled in Company settings.
          </p>
          <ul className="list-disc pl-4 space-y-1 mb-2 text-sm">
            <li>Rate: <strong>{rate}%</strong> of taxable wages this period</li>
            <li>Taxable wages = min(gross pay, remaining FUTA balance)</li>
            <li>Annual wage cap: $7,000 per employee</li>
          </ul>
          <p className="text-gray-300 text-[11px]">
            Included in Total Deductions. Net Pay = Gross − Total Deductions.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TotalDeductionsColumnInfo() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full text-red-600 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="How total deductions are calculated"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-sm bg-gray-900 text-gray-100 border border-gray-700 p-3 text-left leading-relaxed"
        >
          <p className="font-semibold text-white mb-2">Total Deductions</p>
          <p className="mb-2 text-sm">Sum of all amounts taken from gross pay this period:</p>
          <ul className="list-disc pl-4 space-y-1 text-sm">
            <li>Taxes (federal, state, FICA, Medicare, SDI, etc.)</li>
            <li>FUTA (when enabled)</li>
            <li>Other deduction columns on this sheet</li>
          </ul>
          <p className="text-gray-300 text-[11px] mt-2">Net Pay = Gross Pay − Total Deductions</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function createCustomDeductionId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatCutoffRangeLabel(period, tz = 'UTC') {
  const start = toLocalDateStr(period.periodStart, tz);
  const end = toLocalDateStr(period.periodEnd, tz);
  return `${start} – ${end}`;
}

function dedupeCutoffPeriodsByRange(periods, tz = 'UTC') {
  const seen = new Set();
  return periods.filter((period) => {
    const key = `${toLocalDateStr(period.periodStart, tz)}|${toLocalDateStr(period.periodEnd, tz)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isClosedCutoff(period) {
  return period.status && period.status !== 'open';
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
  const [companyTimezone, setCompanyTimezone] = useState('UTC');
  const [cutoffPeriods, setCutoffPeriods] = useState([]);
  const [salaryComputed, setSalaryComputed] = useState(false);
  const [salaryComputing, setSalaryComputing] = useState(false);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [futaSettings, setFutaSettings] = useState({ enabled: false, rate: 7 });
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [earningTypes, setEarningTypes] = useState([]);
  const [customDeductionColumns, setCustomDeductionColumns] = useState([]);
  const [deductionInputs, setDeductionInputs] = useState({});
  const [columnHeaderInputs, setColumnHeaderInputs] = useState({});
  const [showAddDeductionColumn, setShowAddDeductionColumn] = useState(false);
  const [newCustomDeduction, setNewCustomDeduction] = useState({ label: '', calculationType: 'fixed' });
  const [checkNumber, setCheckNumber] = useState('');
  const [savedPayrollRunId, setSavedPayrollRunId] = useState(null);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [sendingAllPayslips, setSendingAllPayslips] = useState(false);
  const [payslipLoading, setPayslipLoading] = useState({});

  const invalidateSavedPayroll = useCallback(() => {
    setSavedPayrollRunId(null);
  }, []);

  const fetchCutoffPeriods = useCallback(async () => {
    if (!token) return [];

    const fetchList = async (query = '') => {
      const res = await fetch(`${API_URL}/api/cutoff-periods?limit=200${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return res.ok ? data.data || [] : [];
    };

    const statuses = ['open', 'locked', 'processed', 'closed'];
    const responses = await Promise.all([
      fetchList(),
      ...statuses.map((status) => fetchList(`&status=${status}`)),
    ]);

    const seenIds = new Set();
    const merged = responses.flat().filter((period) => {
      if (!period?.id || seenIds.has(period.id)) return false;
      seenIds.add(period.id);
      return true;
    });

    return merged.sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart));
  }, [token]);

  const fetchHoursForPeriod = useCallback(async (from, to) => {
    if (!token || !from || !to) return { hoursByUserId: {}, summary: null };

    const res = await fetch(
      `${API_URL}/api/payroll-system/import-clock-hours?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch punch hours');
    }

    const hoursByUserId = {};
    (data.data?.employees || []).forEach((emp) => {
      hoursByUserId[emp.userId] = mapClockHoursEntry(emp);
    });

    return { hoursByUserId, summary: data.data?.summary ?? null };
  }, [token]);

  const mergeHoursIntoRows = useCallback((employeeRows, hoursByUserId) => {
    return employeeRows.map((row) => {
      const hours = hoursByUserId[row.id];
      if (!hours) {
        return {
          ...row,
          regularHours: null,
          overtimeHours: null,
          totalPunchHours: null,
          rawClockedHours: null,
          daysWorked: null,
          hasActiveClockIn: false,
          hasPendingOT: false,
          pendingOTCount: 0,
        };
      }

      return {
        ...row,
        ...hours,
        payType: hours.payType ?? row.payType,
        payRate: hours.payRate ?? row.payRate,
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
      hasPendingOT: false,
      pendingOTCount: 0,
    }));
  }, []);

  const clearSalaryFromRows = useCallback((employeeRows) => {
    return employeeRows.map((row) => ({
      ...row,
      grossPay: null,
      taxes: null,
      taxBreakdown: null,
      deductions: null,
      netPay: null,
      computeError: null,
      deductionBreakdown: null,
      futaDeduction: null,
    }));
  }, []);

  const enabledDeductionTypes = useMemo(
    () => deductionTypes.filter((dt) => dt.enabled !== false),
    [deductionTypes]
  );

  const allDeductionColumns = useMemo(
    () => [...enabledDeductionTypes, ...customDeductionColumns],
    [enabledDeductionTypes, customDeductionColumns]
  );

  const applyDeductionsToRow = useCallback(
    (row, inputsByType = {}, columns = allDeductionColumns, futaOverride = futaSettings) => {
      if (row.grossPay == null || row.taxes == null || row.computeError) {
        return row;
      }

      let totalDeductions = 0;
      const deductionBreakdown = {};

      columns.forEach((dt) => {
        const inputValue = inputsByType[dt.id] ?? '';
        const amount = calculateDeductionValue(dt, inputValue, row.grossPay);
        deductionBreakdown[dt.id] = amount;
        totalDeductions += amount;
      });

      let futaDeduction = null;

      if (futaOverride?.enabled) {
        const balance = row.payrollDetails?.futaBalance ?? DEFAULT_FUTA_WAGE_CAP;
        futaDeduction = calculateFutaDeduction(row.grossPay, balance, futaOverride.rate);
        totalDeductions += futaDeduction;
      }

      totalDeductions += row.taxes;

      const deductions = round2(totalDeductions);
      return {
        ...row,
        deductionBreakdown,
        futaDeduction,
        deductions,
        netPay: round2(row.grossPay - deductions),
      };
    },
    [allDeductionColumns, futaSettings]
  );

  const handleAddCustomDeductionColumn = () => {
    const label = newCustomDeduction.label.trim();
    if (!label) {
      toast.error('Column name is required');
      return;
    }

    const newColumn = {
      id: createCustomDeductionId(),
      label,
      calculationType: newCustomDeduction.calculationType,
      isCustom: true,
    };

    setCustomDeductionColumns((prev) => [...prev, newColumn]);
    setShowAddDeductionColumn(false);
    setNewCustomDeduction({ label: '', calculationType: 'fixed' });

    if (salaryComputed) {
      const updatedColumns = [...allDeductionColumns, newColumn];
      setRows((rows) =>
        rows.map((row) =>
          applyDeductionsToRow(
            row,
            {
              ...deductionInputs[row.id],
              [newColumn.id]: '',
            },
            updatedColumns
          )
        )
      );
    }

    toast.success(`Added "${label}" deduction column`);
  };

  const handleColumnHeaderDeductionChange = useCallback(
    (deductionTypeId, value) => {
      invalidateSavedPayroll();
      setColumnHeaderInputs((prev) => ({ ...prev, [deductionTypeId]: value }));

      setDeductionInputs((prev) => {
        const next = { ...prev };

        setRows((currentRows) => {
          const updatedRows = currentRows.map((row) => {
            const rowInputs = {
              ...next[row.id],
              [deductionTypeId]: value,
            };
            next[row.id] = rowInputs;
            return applyDeductionsToRow(row, rowInputs);
          });
          return updatedRows;
        });

        return next;
      });
    },
    [applyDeductionsToRow, invalidateSavedPayroll]
  );

  const handleCustomColumnLabelChange = (columnId, label) => {
    setCustomDeductionColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, label } : col))
    );
  };

  const handleRemoveCustomDeductionColumn = (columnId) => {
    const remainingColumns = allDeductionColumns.filter((col) => col.id !== columnId);

    setCustomDeductionColumns((prev) => prev.filter((col) => col.id !== columnId));
    setColumnHeaderInputs((prev) => {
      const { [columnId]: _removed, ...rest } = prev;
      return rest;
    });

    setDeductionInputs((prev) => {
      const next = {};
      Object.entries(prev).forEach(([employeeId, inputs]) => {
        const { [columnId]: _removed, ...rest } = inputs;
        next[employeeId] = rest;
      });

      setRows((rows) =>
        rows.map((row) => applyDeductionsToRow(row, next[row.id] ?? {}, remainingColumns))
      );

      return next;
    });

    toast.success('Deduction column removed');
  };

  const handleDeductionInputChange = useCallback(
    (employeeId, deductionTypeId, value) => {
      invalidateSavedPayroll();
      setDeductionInputs((prev) => {
        const nextInputs = {
          ...prev[employeeId],
          [deductionTypeId]: value,
        };

        setRows((rows) =>
          rows.map((row) =>
            row.id === employeeId ? applyDeductionsToRow(row, nextInputs) : row
          )
        );

        return {
          ...prev,
          [employeeId]: nextInputs,
        };
      });
    },
    [applyDeductionsToRow, invalidateSavedPayroll]
  );

  const getEligiblePayrollRows = useCallback(() => {
    return rows.filter((row) => row.grossPay != null && !row.computeError);
  }, [rows]);

  const savePayrollFromSheet = useCallback(async () => {
    const eligibleRows = getEligiblePayrollRows();
    if (eligibleRows.length === 0) {
      throw new Error('Compute salary first — no employees with pay data to save');
    }

    const employeesData = eligibleRows.map((row) => {
      const employee = {
        payrollDetails: row.payrollDetails,
        earningRates: row.earningRates || {},
      };
      const taxes = calculateTaxes(employee, row.grossPay);

      return {
        id: row.id,
        name: row.name,
        position: row.position,
        payrollDetails: row.payrollDetails,
        calculated: {
          grossEarnings: row.grossPay,
          totalDeductions: row.deductions,
          netPay: round2(row.grossPay - row.deductions),
          deductionsBreakdown: row.deductionBreakdown || {},
          earningsBreakdown: {},
        },
        taxes,
        netPayAfterTaxes: row.netPay,
      };
    });

    const hoursData = {};
    eligibleRows.forEach((row) => {
      hoursData[row.id] = {
        regularHours: row.regularHours ?? 0,
        overtimeHours: row.overtimeHours ?? 0,
        isFinalClock: true,
      };
    });

    const totals = {
      grossEarnings: round2(employeesData.reduce((sum, emp) => sum + emp.calculated.grossEarnings, 0)),
      totalTaxes: round2(employeesData.reduce((sum, emp) => sum + emp.taxes.totalTaxes, 0)),
      totalDeductions: round2(employeesData.reduce((sum, emp) => sum + emp.calculated.totalDeductions, 0)),
      netPay: round2(employeesData.reduce((sum, emp) => sum + emp.netPayAfterTaxes, 0)),
    };

    const response = await fetch(`${API_URL}/api/payroll-system/save-payroll-run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payDate: new Date().toISOString().split('T')[0],
        periodStart: dateRange.from,
        periodEnd: dateRange.to,
        checkNumberStart: checkNumber || '1',
        employees: employeesData,
        earningTypes: (earningTypes || []).filter((et) => et.enabled !== false),
        deductionTypes: allDeductionColumns,
        totals,
        hoursData,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Failed to save payroll');
    }

    const payrollRunId = result.data?.payrollRunId ?? result.data?.id;
    if (!payrollRunId) {
      throw new Error('Payroll saved but run ID was not returned');
    }

    setSavedPayrollRunId(payrollRunId);
    return payrollRunId;
  }, [
    allDeductionColumns,
    checkNumber,
    dateRange.from,
    dateRange.to,
    earningTypes,
    getEligiblePayrollRows,
    token,
  ]);

  const ensurePayrollSaved = useCallback(async () => {
    if (savedPayrollRunId) return savedPayrollRunId;
    setSavingPayroll(true);
    try {
      return await savePayrollFromSheet();
    } finally {
      setSavingPayroll(false);
    }
  }, [savedPayrollRunId, savePayrollFromSheet]);

  const handleSavePayroll = async () => {
    try {
      setSavingPayroll(true);
      await savePayrollFromSheet();
      toast.success('Payroll saved — you can now send payslips');
    } catch (err) {
      toast.error(err.message || 'Failed to save payroll');
    } finally {
      setSavingPayroll(false);
    }
  };

  const runPayslipAction = async (row, action) => {
    if (!row.grossPay || row.computeError) return;

    setPayslipLoading((prev) => ({ ...prev, [row.id]: action }));
    try {
      const payrollRunId = await ensurePayrollSaved();
      const params = { apiUrl: API_URL, token, payrollRunId, employeeId: row.id };

      if (action === 'view') {
        await viewPayslipPdf(params);
      } else if (action === 'download') {
        await downloadPayslipPdf(params);
        toast.success(`Payslip downloaded for ${row.name}`);
      } else {
        if (!isValidEmployeeEmail(row.email)) {
          toast.error(`${row.name} has no valid email on file`);
          return;
        }
        await sendPayslipEmail(params);
        toast.success(`Payslip sent to ${row.email}`);
      }
    } catch (err) {
      toast.error(err.message || 'Payslip action failed');
    } finally {
      setPayslipLoading((prev) => ({ ...prev, [row.id]: null }));
    }
  };

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
        taxBreakdown: null,
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
      const { hoursByUserId, summary } = await fetchHoursForPeriod(from, to);
      setRows(mergeHoursIntoRows(currentRows, hoursByUserId));
      setHoursLoaded(true);

      if (summary) {
        toast.success(
          `Loaded ${summary.totalEmployees} employees: ${summary.totalRegularHours} regular hrs, ${summary.totalOvertimeHours} OT hrs (${from} to ${to})`
        );
        if (summary.employeesWithActiveClockIn > 0) {
          toast.warning(`${summary.employeesWithActiveClockIn} employee(s) still clocked in — hours may change`);
        }
        if (summary.employeesWithPendingOT > 0) {
          toast.info(`${summary.employeesWithPendingOT} employee(s) have pending OT not included in OT hrs`);
        }
      } else {
        toast.success(`Hours loaded for ${from} to ${to}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load punch hours');
      setHoursLoaded(false);
    } finally {
      setHoursLoading(false);
    }
  }, [fetchHoursForPeriod, mergeHoursIntoRows]);

  useEffect(() => {
    if (!token) return;

    fetch(`${API_URL}/api/payroll-system/suggested-check-number`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.data?.suggestedCheckNumber != null) {
          setCheckNumber(String(result.data.suggestedCheckNumber));
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        setLoading(true);
        const [employeeRows, periods, settingsRes] = await Promise.all([
          fetchEmployees(),
          fetchCutoffPeriods(),
          fetch(`${API_URL}/api/company-information/company-settings`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .catch(() => null),
        ]);

        const tz =
          settingsRes?.data?.company?.timezone ||
          settingsRes?.data?.timezone ||
          settingsRes?.data?.companyTimezone ||
          'UTC';
        setCompanyTimezone(tz);

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
    setDeductionInputs({});
    setColumnHeaderInputs({});
    invalidateSavedPayroll();
    await loadHours(dateRange.from, dateRange.to, baseRows);
  };

  const handleComputeSalary = async () => {
    if (!hoursLoaded) {
      toast.warning('Load hours first — hourly employees need punch data for this period.');
    }

    try {
      setSalaryComputing(true);
      invalidateSavedPayroll();

      const [detailsRes, settingsRes, futaRes] = await Promise.all([
        fetch(`${API_URL}/api/employee-payroll-details/employees-with-details`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/company-information/company-settings`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/deductions/settings`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
      ]);

      const detailsData = await detailsRes.json();
      const settingsData = await settingsRes.json();
      const futaData = await futaRes.json();

      if (!detailsRes.ok || !detailsData.success) {
        throw new Error(detailsData.message || 'Failed to fetch employee payroll details');
      }
      if (!settingsRes.ok || !settingsData.success) {
        throw new Error(settingsData.message || 'Failed to fetch company settings');
      }

      const activeFutaSettings = futaRes.ok && futaData.success
        ? {
            enabled: Boolean(futaData.data?.futaEnabled),
            rate: futaData.data?.futaRate ?? 7,
          }
        : { enabled: false, rate: 7 };
      setFutaSettings(activeFutaSettings);

      const { employees: payrollEmployees, earningTypes, deductionTypes: dtData } = detailsData.data;
      const { company, payrollConfig } = settingsData.data;
      const payFrequency = payrollConfig?.payFrequency || 'biweekly';

      setDeductionTypes(dtData || []);
      setEarningTypes(earningTypes || []);
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

      const allTypes = [
        ...(dtData || []).filter((dt) => dt.enabled !== false),
        ...customDeductionColumns,
      ];

      setRows((prev) => {
        const rebuiltInputs = {};

        const updatedRows = prev.map((row) => {
          const detail = detailById[row.id];
          if (!detail?.payrollDetails) {
            skippedCount++;
            return {
              ...row,
              grossPay: null,
              taxes: null,
              taxBreakdown: null,
              deductions: null,
              netPay: null,
              computeError: 'no_profile',
              deductionBreakdown: null,
              futaDeduction: null,
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
            return {
              ...row,
              payrollDetails: detail.payrollDetails,
              earningRates: detail.earningRates || {},
              payType: detail.payrollDetails.payType,
              payRate: detail.payrollDetails.payRate,
              grossPay: null,
              taxes: null,
              taxBreakdown: null,
              deductions: null,
              netPay: null,
              computeError: result.error,
              deductionBreakdown: null,
              futaDeduction: null,
            };
          }

          computedCount++;

          const taxBreakdown = calculateTaxes(employee, result.grossPay);

          const baseRow = {
            ...row,
            payrollDetails: detail.payrollDetails,
            earningRates: detail.earningRates || {},
            payType: detail.payrollDetails.payType,
            payRate: detail.payrollDetails.payRate,
            grossPay: result.grossPay,
            taxes: taxBreakdown.totalTaxes,
            taxBreakdown,
            computeError: null,
          };

          const rowInputs = {};
          allTypes.forEach((dt) => {
            rowInputs[dt.id] = columnHeaderInputs[dt.id] ?? deductionInputs[row.id]?.[dt.id] ?? '';
          });
          rebuiltInputs[row.id] = rowInputs;

          return applyDeductionsToRow(baseRow, rowInputs, allTypes, activeFutaSettings);
        });

        setDeductionInputs(rebuiltInputs);
        return updatedRows;
      });

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

  const handleQuickFillCutoff = async (cutoffId) => {
    if (!cutoffId) return;
    const period = cutoffPeriods.find((p) => p.id === cutoffId);
    if (!period) return;

    const from = toLocalDateStr(period.periodStart, companyTimezone);
    const to = toLocalDateStr(period.periodEnd, companyTimezone);

    setDateRange({ from, to });
    setHoursLoaded(false);
    setSalaryComputed(false);
    setDeductionInputs({});
    setColumnHeaderInputs({});
    invalidateSavedPayroll();

    const baseRows = clearSalaryFromRows(clearHoursFromRows(rows));
    setRows(baseRows);
    await loadHours(from, to, baseRows);
  };

  const handleRefresh = async () => {
    const shouldRecompute = salaryComputed;
    try {
      setLoading(true);
      setSalaryComputed(false);
      setDeductionInputs({});
      setColumnHeaderInputs({});
      invalidateSavedPayroll();
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

  const { openCutoffPeriods, closedCutoffPeriods } = useMemo(() => {
    const unique = dedupeCutoffPeriodsByRange(cutoffPeriods, companyTimezone);
    const open = [];
    const closed = [];
    unique.forEach((period) => {
      if (isClosedCutoff(period)) closed.push(period);
      else open.push(period);
    });
    const byDateDesc = (a, b) => new Date(b.periodStart) - new Date(a.periodStart);
    open.sort(byDateDesc);
    closed.sort(byDateDesc);
    return { openCutoffPeriods: open, closedCutoffPeriods: closed };
  }, [cutoffPeriods, companyTimezone]);

  const sheetColumns = useMemo(() => {
    const cols = [...BASE_COLUMNS];
    if (hoursLoaded) cols.push(...HOURS_COLUMNS);
    cols.push(PAY_TYPE_COLUMN);
    if (salaryComputed) {
      cols.push(SALARY_COLUMNS[0]);
      allDeductionColumns.forEach((dt) => {
        cols.push({
          key: `deduction_${dt.id}`,
          label: dt.label,
          align: 'right',
          deductionType: dt,
          isDeductionInput: true,
          isCustomDeduction: !!dt.isCustom,
        });
      });
      if (futaSettings.enabled) {
        cols.push(FUTA_DEDUCTION_COLUMN);
      }
      cols.push(...TAX_COLUMNS, TAX_TOTAL_COLUMN);
      cols.push(
        { key: 'deductions', label: 'Total Deductions', align: 'right' },
        { key: 'netPay', label: 'Net Pay', align: 'right' },
      );
      cols.push({ key: 'actions', label: 'Payslip', align: 'center', isActions: true });
    }
    return cols;
  }, [hoursLoaded, salaryComputed, allDeductionColumns, futaSettings.enabled]);

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

  const handleSendAllPayslips = async () => {
    const eligible = filteredRows.filter(
      (row) => row.grossPay != null && !row.computeError && isValidEmployeeEmail(row.email)
    );

    if (eligible.length === 0) {
      toast.error('No employees with computed pay and a valid email address');
      return;
    }

    const skipped = filteredRows.filter(
      (row) => row.grossPay != null && !row.computeError && !isValidEmployeeEmail(row.email)
    ).length;

    try {
      setSendingAllPayslips(true);
      const payrollRunId = await ensurePayrollSaved();
      const result = await sendAllPayslipEmails({
        apiUrl: API_URL,
        token,
        payrollRunId,
        employeeIds: eligible.map((row) => row.id),
      });

      const sent = result.data?.sent ?? result.sent ?? eligible.length;
      toast.success(`Sent ${sent} payslip(s)${skipped > 0 ? ` (${skipped} skipped — no email)` : ''}`);
    } catch (err) {
      toast.error(err.message || 'Failed to send payslips');
    } finally {
      setSendingAllPayslips(false);
    }
  };

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
    const deductionTotals = {};
    allDeductionColumns.forEach((dt) => {
      deductionTotals[dt.id] = 0;
    });

    const taxTotals = TAX_COLUMNS.reduce((acc, col) => {
      acc[col.breakdownKey] = 0;
      return acc;
    }, {});

    const totals = filteredRows.reduce(
      (acc, row) => {
        if (row.grossPay != null) acc.gross += row.grossPay;
        if (row.taxes != null) acc.taxes += row.taxes;
        if (row.deductions != null) acc.deductions += row.deductions;
        if (row.netPay != null) acc.net += row.netPay;
        if (row.futaDeduction != null) acc.futa += row.futaDeduction;
        allDeductionColumns.forEach((dt) => {
          const amount = row.deductionBreakdown?.[dt.id];
          if (amount != null) acc.deductionTotals[dt.id] += amount;
        });
        TAX_COLUMNS.forEach((col) => {
          const amount = row.taxBreakdown?.[col.breakdownKey];
          if (amount != null) acc.taxTotals[col.breakdownKey] += amount;
        });
        return acc;
      },
      { gross: 0, taxes: 0, deductions: 0, net: 0, futa: 0, deductionTotals, taxTotals }
    );

    return totals;
  }, [filteredRows, allDeductionColumns]);

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
        allDeductionColumns.forEach((dt) => {
          const amount = row.deductionBreakdown?.[dt.id] ?? 0;
          const input = deductionInputs[row.id]?.[dt.id] ?? '';
          const suffix = dt.calculationType === 'percent' ? '%' : '';
          const colLabel = dt.isCustom ? `${dt.label} (custom)` : dt.label;
          base[colLabel] = input
            ? `${input}${suffix} → ${formatCurrency(amount)}`
            : formatCurrency(amount);
        });
        if (futaSettings.enabled) {
          base.FUTA = formatCurrency(row.futaDeduction);
        }
        TAX_COLUMNS.forEach((col) => {
          base[col.label] = formatCurrency(row.taxBreakdown?.[col.breakdownKey]);
        });
        base['Tax Total'] = formatCurrency(row.taxes);
        base['Total Deductions'] = formatCurrency(row.deductions);
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
    const taxCol = TAX_COLUMNS.find((col) => col.key === key);
    if (taxCol) {
      if (row.computeError === 'no_pay_rate') return 'No rate';
      if (row.computeError === 'no_profile' || row.grossPay == null) return '—';
      const value = row.taxBreakdown?.[taxCol.breakdownKey];
      return value != null ? formatCurrency(value) : '—';
    }

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
      case 'futaDeduction':
        if (row.computeError || row.grossPay == null) return '—';
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
                  setRows((prev) => clearHoursFromRows(prev));
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
                  setRows((prev) => clearHoursFromRows(prev));
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
            {(openCutoffPeriods.length > 0 || closedCutoffPeriods.length > 0) && (
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">Cut-offs</label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    handleQuickFillCutoff(e.target.value);
                    e.target.value = '';
                  }}
                  className="px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 min-w-[220px]"
                >
                  <option value="" disabled>Select cutoff range...</option>
                  {openCutoffPeriods.length > 0 && (
                    <optgroup label="Open">
                      {openCutoffPeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {formatCutoffRangeLabel(period, companyTimezone)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {closedCutoffPeriods.length > 0 && (
                    <optgroup label="Closed">
                      {closedCutoffPeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {formatCutoffRangeLabel(period, companyTimezone)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}
          </div>
          {hoursLoaded && !hoursLoading && (
            <p className="mt-2 text-xs text-blue-700">
              Showing punch hours for {dateRange.from} to {dateRange.to} (active employees &amp; supervisors
              only — same import as Create Paycheck; OT includes approved hours only)
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
                  {futaSettings.enabled && (
                    <>
                      {' · '}
                      FUTA enabled at <span className="font-medium">{futaSettings.rate}%</span> (deducted from gross)
                    </>
                  )}
                  {savedPayrollRunId && (
                    <>
                      {' · '}
                      <span className="font-medium">Payroll saved</span> — payslips ready to send
                    </>
                  )}
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
            {salaryComputed && (
              <>
                <button
                  onClick={() => setShowAddDeductionColumn(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  <Plus className="w-4 h-4" />
                  Add Deduction Column
                </button>
                <button
                  onClick={handleSavePayroll}
                  disabled={savingPayroll || sendingAllPayslips}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {savingPayroll ? 'Saving...' : savedPayrollRunId ? 'Re-save Payroll' : 'Save Payroll'}
                </button>
                <button
                  onClick={handleSendAllPayslips}
                  disabled={savingPayroll || sendingAllPayslips}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mail className="w-4 h-4" />
                  {sendingAllPayslips ? 'Sending...' : 'Send All Payslips'}
                </button>
              </>
            )}
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
            <table className="w-full border-collapse text-sm min-w-[1600px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#f3f3f3]">
                  <th className={`sticky ${STICKY_ROW_NUM_LEFT} z-40 min-w-[48px] px-2 py-2 text-center text-xs font-semibold text-gray-600 border border-gray-300 bg-[#e8e8e8] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}>
                    #
                  </th>
                  {sheetColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 bg-[#f3f3f3] whitespace-nowrap ${
                        col.key === 'totalPunchHours' ? 'bg-green-100 text-green-800' : ''
                      } ${col.isTax ? 'bg-blue-50 text-blue-800' : ''} ${
                        col.isTaxTotal ? 'bg-blue-100 text-blue-800' : ''
                      } ${col.key === 'deductions' ? 'bg-red-100 text-red-800' : ''} ${
                        col.key === 'netPay' ? 'bg-orange-100 text-orange-800' : ''
                      } ${
                        col.isFuta ? 'bg-red-50 text-red-800' : ''
                      } ${
                        col.key === 'name'
                          ? `sticky ${STICKY_NAME_LEFT} z-30 min-w-[150px] bg-[#f3f3f3] shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]`
                          : ''
                      } ${col.isDeductionInput ? 'bg-red-50 text-red-800 min-w-[110px]' : ''} ${
                        col.isActions ? 'sticky right-0 z-30 bg-violet-50 text-violet-800 min-w-[120px]' : ''
                      }`}
                      style={{ textAlign: col.align }}
                    >
                      {col.isActions ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{col.label}</span>
                          <span className="text-[10px] font-normal text-violet-600">View · Download · Send</span>
                        </div>
                      ) : col.isDeductionInput ? (
                        <div className="flex flex-col gap-1">
                          <div
                            className={`inline-flex items-center gap-1 ${
                              col.align === 'right' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {col.isCustomDeduction ? (
                              <input
                                type="text"
                                value={col.label}
                                onChange={(e) =>
                                  handleCustomColumnLabelChange(col.deductionType.id, e.target.value)
                                }
                                className="w-24 px-1 py-0.5 text-xs font-semibold border border-transparent hover:border-red-200 focus:border-red-300 rounded bg-transparent focus:bg-white focus:outline-none"
                                title="Edit column name"
                              />
                            ) : (
                              <span>{col.label}</span>
                            )}
                            {col.isCustomDeduction && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomDeductionColumn(col.deductionType.id)}
                                className="inline-flex items-center justify-center rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700"
                                aria-label={`Remove ${col.label} column`}
                                title="Remove column"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={columnHeaderInputs[col.deductionType.id] || ''}
                            onChange={(e) =>
                              handleColumnHeaderDeductionChange(col.deductionType.id, e.target.value)
                            }
                            placeholder={
                              col.deductionType.calculationType === 'percent' ? 'All: 0%' : 'All: 0.00'
                            }
                            title="Apply this value to all employees"
                            className="w-full px-2 py-0.5 text-[11px] border border-red-200 rounded text-right bg-white focus:outline-none focus:ring-1 focus:ring-red-400 font-normal"
                          />
                          <span className="text-[10px] font-normal text-red-500">
                            ({col.deductionType.calculationType === 'percent' ? '% of gross' : 'Fixed $'}
                            {col.isCustomDeduction ? ' · custom' : ''} · applies to all)
                          </span>
                        </div>
                      ) : col.isTaxTotal ? (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                          }`}
                        >
                          {col.label}
                          <TaxColumnInfo />
                        </span>
                      ) : col.key === 'futaDeduction' ? (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            col.align === 'right' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {col.label}
                          <FutaColumnInfo rate={futaSettings.rate} />
                        </span>
                      ) : col.key === 'deductions' ? (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            col.align === 'right' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {col.label}
                          <TotalDeductionsColumnInfo />
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
                      <td
                        className={`sticky ${STICKY_ROW_NUM_LEFT} z-20 px-2 py-1.5 text-center text-xs font-mono text-gray-500 border border-gray-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                          index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
                        }`}
                      >
                        {index + 1}
                      </td>
                      {sheetColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-1.5 border border-gray-300 whitespace-nowrap ${
                            ['employeeId', 'payRate', 'regularHours', 'overtimeHours', 'totalPunchHours', 'rawClockedHours', 'daysWorked', 'grossPay', 'taxes', 'deductions', 'netPay', 'futaDeduction', ...TAX_COLUMNS.map((c) => c.key)].includes(col.key)
                              ? 'font-mono text-xs'
                              : 'text-sm'
                          } ${col.key === 'name' ? 'font-medium text-gray-900' : 'text-gray-700'} ${
                            col.key === 'name'
                              ? `sticky ${STICKY_NAME_LEFT} z-10 min-w-[150px] shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)] ${
                                  index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
                                }`
                              : ''
                          } ${
                            col.key === 'totalPunchHours' && row.totalPunchHours != null ? 'font-semibold text-green-700 bg-green-50/50' : ''
                          } ${col.key === 'netPay' && row.netPay != null ? 'font-semibold text-orange-700 bg-orange-50/50' : ''} ${
                            col.key === 'futaDeduction' && row.futaDeduction != null ? 'font-semibold text-red-700 bg-red-50/50' : ''
                          } ${
                            col.isActions ? 'sticky right-0 z-10 bg-inherit' : ''
                          }`}
                          style={{ textAlign: col.align }}
                        >
                          {col.isActions ? (
                            <PayslipActionButtons
                              disabled={!row.grossPay || !!row.computeError}
                              sendDisabled={!isValidEmployeeEmail(row.email)}
                              sendDisabledReason={
                                !isValidEmployeeEmail(row.email) ? 'No email on file' : undefined
                              }
                              loadingAction={payslipLoading[row.id]}
                              onView={() => runPayslipAction(row, 'view')}
                              onDownload={() => runPayslipAction(row, 'download')}
                              onSend={() => runPayslipAction(row, 'send')}
                            />
                          ) : col.key === 'status' ? (
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
                          ) : col.key === 'name' && (row.hasActiveClockIn || row.hasPendingOT) ? (
                            <span className="flex items-center gap-1.5 flex-wrap">
                              {row.name}
                              {row.hasActiveClockIn && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                  CLOCKED IN
                                </span>
                              )}
                              {row.hasPendingOT && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">
                                  PENDING OT
                                </span>
                              )}
                            </span>
                          ) : col.isDeductionInput ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <input
                                type="text"
                                value={deductionInputs[row.id]?.[col.deductionType.id] || ''}
                                onChange={(e) =>
                                  handleDeductionInputChange(row.id, col.deductionType.id, e.target.value)
                                }
                                placeholder={col.deductionType.calculationType === 'percent' ? '0%' : '0.00'}
                                disabled={row.computeError || row.grossPay == null}
                                className="w-20 px-2 py-0.5 text-xs border border-red-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-red-400 disabled:bg-gray-100 disabled:text-gray-400"
                              />
                              <span className="text-[10px] font-semibold text-red-700">
                                {formatCurrency(row.deductionBreakdown?.[col.deductionType.id] ?? 0)}
                              </span>
                            </div>
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
                    <td className={`sticky ${STICKY_ROW_NUM_LEFT} z-30 px-2 py-2 text-xs font-bold text-gray-700 border border-gray-300 bg-gray-200 text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}>
                      Σ
                    </td>
                    {sheetColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2 text-xs font-bold text-gray-800 border border-gray-300 font-mono ${
                          col.key === 'name'
                            ? `sticky ${STICKY_NAME_LEFT} z-20 min-w-[150px] bg-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]`
                            : ''
                        }`}
                        style={{ textAlign: col.align }}
                      >
                        {col.key === 'regularHours' && formatHours(hoursTotals.regular)}
                        {col.key === 'overtimeHours' && formatHours(hoursTotals.ot)}
                        {col.key === 'totalPunchHours' && formatHours(hoursTotals.totalPunch)}
                        {col.key === 'grossPay' && formatCurrency(salaryTotals.gross)}
                        {col.isDeductionInput &&
                          formatCurrency(salaryTotals.deductionTotals[col.deductionType.id] ?? 0)}
                        {col.isTax && formatCurrency(salaryTotals.taxTotals[col.breakdownKey] ?? 0)}
                        {col.isTaxTotal && formatCurrency(salaryTotals.taxes)}
                        {col.key === 'deductions' && formatCurrency(salaryTotals.deductions)}
                        {col.key === 'netPay' && formatCurrency(salaryTotals.net)}
                        {col.key === 'futaDeduction' && formatCurrency(salaryTotals.futa)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          1) Set dates and Load Hours · 2) Compute Salary · 3) Adjust deductions · 4) Save payroll · 5) Export{' '}
          <strong>Payroll Summary</strong> from the Reports tab or use row <strong>Payslip</strong> actions.
        </p>

        {showAddDeductionColumn && (
          <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setShowAddDeductionColumn(false);
                setNewCustomDeduction({ label: '', calculationType: 'fixed' });
              }}
            />
            <div className="relative bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-1 text-gray-900">Add Deduction Column</h3>
              <p className="text-sm text-gray-500 mb-4">
                Adds a new column to this sheet only — not saved to company settings.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Column name</label>
                  <input
                    type="text"
                    value={newCustomDeduction.label}
                    onChange={(e) =>
                      setNewCustomDeduction((prev) => ({ ...prev, label: e.target.value }))
                    }
                    placeholder="e.g., Uniform Fee, Loan Repayment"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Value type</label>
                  <select
                    value={newCustomDeduction.calculationType}
                    onChange={(e) =>
                      setNewCustomDeduction((prev) => ({ ...prev, calculationType: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="fixed">Fixed amount ($)</option>
                    <option value="percent">Percentage of gross (%)</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleAddCustomDeductionColumn}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Add Column
                </button>
                <button
                  onClick={() => {
                    setShowAddDeductionColumn(false);
                    setNewCustomDeduction({ label: '', calculationType: 'fixed' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        )}
      </div>
    </>
  );
};

export default EmployeeSheet;
