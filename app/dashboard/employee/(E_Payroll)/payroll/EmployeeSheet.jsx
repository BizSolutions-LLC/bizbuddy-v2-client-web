'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { jwtDecode } from 'jwt-decode';
import useAuthStore from '@/store/useAuthStore';
import {
  computeEmployeePayroll,
  calculateDeductionValue,
  calculateTaxes,
  calculateFutaDeduction,
  calculateEmployerWageBaseTax,
  getFederalTaxDetail,
  getStateTaxDetail,
  round2,
  DEFAULT_TAX_RATES,
  DEFAULT_FUTA_WAGE_CAP,
  DEFAULT_SUI_RATE,
  DEFAULT_ETT_RATE,
} from '@/lib/payrollCompute';
import {
  viewPayslipPdf,
  downloadPayslipPdf,
  sendPayslipEmail,
  isValidEmployeeEmail,
} from '@/lib/payslipActions';
import {
  fetchPaidEmployeeIdsForPayrollRun,
  UNVERIFIED_PAYMENT_PAYSLIP_MESSAGE,
} from '@/lib/disbursementApi';
import PayslipActionButtons from '@/components/payroll/PayslipActionButtons';
import ModalPortal from '@/components/ui/modal-portal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import {
  Info,
  Plus,
  X,
  FileSpreadsheet,
  Save,
  MoreHorizontal,
  RefreshCw,
  Download,
  Calculator,
  Clock,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
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
  { key: 'driverPayRate', label: 'Driver Rate', align: 'right' },
  { key: 'hourlyRate', label: 'Legacy Rate', align: 'right' },
];

const PAY_TYPE_COLUMN = { key: 'payType', label: 'Pay Type', align: 'center' };

const HOURS_COLUMNS = [
  { key: 'regularHours', label: 'Regular Hrs', align: 'right' },
  { key: 'overtimeHours', label: 'OT Hrs', align: 'right' },
  { key: 'driverHours', label: 'Driver Hrs', align: 'right' },
  { key: 'trainingHours', label: 'Training Hrs', align: 'right' },
  { key: 'ptoHours', label: 'PTO', align: 'right' },
  { key: 'totalPunchHours', label: 'Total Punch Hrs', align: 'right' },
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
const SUI_EMPLOYER_COLUMN = { key: 'suiDeduction', label: 'CA SUI', align: 'right', isEmployerCost: true };
const ETT_EMPLOYER_COLUMN = { key: 'ettDeduction', label: 'CA ETT', align: 'right', isEmployerCost: true };

function employerCostForRow(row, suiSettings, ettSettings) {
  if (row.grossPay == null || row.computeError) {
    return { suiDeduction: null, ettDeduction: null };
  }

  return {
    suiDeduction: suiSettings?.enabled
      ? calculateEmployerWageBaseTax(row.grossPay, row.payrollDetails?.suiBalance, suiSettings.rate)
      : null,
    ettDeduction: ettSettings?.enabled
      ? calculateEmployerWageBaseTax(row.grossPay, row.payrollDetails?.ettBalance, ettSettings.rate)
      : null,
  };
}

function toLocalDateStr(isoDate, tz = 'UTC') {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-CA', { timeZone: tz });
}

/** Match server payrollExportService.toDateStr — UTC YYYY-MM-DD for batch keys. */
function toUtcDateStr(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function periodRangeKey(periodStart, periodEnd) {
  return `${toUtcDateStr(periodStart)}|${toUtcDateStr(periodEnd)}`;
}

/** Last token of "First Last" display names from get-employees-list. */
function getLastNameSortKey(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts[parts.length - 1].toLowerCase();
}

/** Reformats "First Middle Last" display names as "Last, First Middle". */
function formatNameLastFirst(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return name || '—';
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(' ');
  return `${last}, ${rest}`;
}

function mapPayrollExportEntry(emp) {
  const regular = Number(emp.RegularHours) || 0;
  const ot = Number(emp.OTHours) || 0;
  const driver = Number(emp.DriverHours) || 0;
  const training = Number(emp.TrainingHours) || 0;
  const pto = Number(emp.PTO) || 0;
  return {
    regularHours: regular,
    overtimeHours: ot,
    driverHours: driver,
    trainingHours: training,
    ptoHours: pto,
    totalPunchHours: +(regular + ot + driver + training + pto).toFixed(2),
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

function TaxColumnInfo({ taxRates = DEFAULT_TAX_RATES }) {
  const { ficaRate, medicareRate, sdiRate, ficaWageBase } = taxRates;

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
            <li>
              Federal income tax: bracket-based on annualized pay &amp; filing status
              (see Company tab → Federal Income Tax Brackets), unless the employee has a
              custom flat rate set on the Employees tab
            </li>
            <li>
              State income tax: bracket-based on annualized pay &amp; filing status
              (see Company tab → State Income Tax Brackets), unless the employee has a
              custom flat rate set on the Employees tab
            </li>
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
            Federal, Social Security, Medicare, SDI, and PIT are each skipped when that
            tax is marked exempt (Yes) on the Employees tab. This amount is included in
            Total Deductions. Net Pay = Gross − Total Deductions.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const FILING_STATUS_LABELS = {
  single: 'Single',
  head_of_household: 'Head of Household',
  married_filing_separately: 'Married Filing Separately',
};

function formatIncomeShort(value) {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '$0';
  return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/**
 * Hover breakdown for a Federal or State tax cell — shows the annualized-wage-method
 * math behind the number. Shared by FederalTaxCellTooltip/StateTaxCellTooltip below,
 * which are thin wrappers supplying the tax-specific label/copy.
 */
function BracketTaxCellTooltip({ detail, children, taxLabel, configureHint, taxField }) {
  if (!detail) return children;

  const {
    filingStatus,
    periodsPerYear,
    periodGross,
    annualIncome,
    hasConfiguredBrackets,
    appliedBrackets,
    annualTax,
    isCustomRate,
    customRate,
    isExempt,
  } = detail;
  const taxAmount = detail[taxField];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dashed border-gray-300 hover:border-gray-500">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="max-w-xs bg-gray-900 text-gray-100 border border-gray-700 p-3 text-left leading-relaxed"
        >
          <p className="font-semibold text-white mb-1.5">{taxLabel}</p>
          {isExempt ? (
            <p className="text-amber-300 text-[11px]">
              This employee is exempt on the Employees tab — $0 withheld. Additional withholding
              amounts still apply if set.
            </p>
          ) : isCustomRate ? (
            <>
              <p className="mb-1.5 text-amber-300">
                Custom rate override: {formatPercent(customRate / 100)} of gross pay (bracket calculation bypassed).
              </p>
              <p className="mb-1.5">
                {formatCurrency(periodGross)} this period × {formatPercent(customRate / 100)} ={' '}
                <strong>{formatCurrency(taxAmount)}</strong> this period
              </p>
              <p className="text-gray-300 text-[11px]">
                Set on the Employees tab → Tax Rate Overrides. Switch back to Auto to use the company&apos;s
                bracket tables.
              </p>
            </>
          ) : (
            <>
              <p className="mb-1.5">
                {formatCurrency(periodGross)} this period × {periodsPerYear} pay periods/yr ={' '}
                <strong>{formatIncomeShort(annualIncome)}</strong> annualized
              </p>
              <p className="mb-1.5 text-gray-300">
                Filing status: {FILING_STATUS_LABELS[filingStatus] || filingStatus}
              </p>
              {hasConfiguredBrackets ? (
                <>
                  <ul className="list-none space-y-0.5 mb-1.5 font-mono text-[11px]">
                    {appliedBrackets.map((b, idx) => (
                      <li key={idx} className="flex justify-between gap-3">
                        <span>
                          {formatPercent(b.rate)} on {formatIncomeShort(b.minAnnualIncome)}–
                          {b.maxAnnualIncome != null ? formatIncomeShort(b.maxAnnualIncome) : '∞'}
                        </span>
                        <span>{formatCurrency(b.taxForBracket)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-1 text-gray-300 text-[11px]">
                    Annual tax {formatCurrency(annualTax)} ÷ {periodsPerYear} periods
                  </p>
                  <p className="font-semibold text-white">= {formatCurrency(taxAmount)} this period</p>
                </>
              ) : (
                <p className="text-amber-300 text-[11px]">{configureHint}</p>
              )}
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FederalTaxCellTooltip({ detail, children }) {
  return (
    <BracketTaxCellTooltip
      detail={detail}
      taxField="federalTax"
      taxLabel="Federal withholding (FWT)"
      configureHint="No federal tax brackets configured for this filing status — $0 withheld. Configure brackets in Company tab → Federal Income Tax Brackets."
    >
      {children}
    </BracketTaxCellTooltip>
  );
}

function StateTaxCellTooltip({ detail, children }) {
  return (
    <BracketTaxCellTooltip
      detail={detail}
      taxField="stateTax"
      taxLabel="State withholding (SWT)"
      configureHint="No state tax brackets configured for this filing status — $0 withheld. Configure brackets in Company tab → State Income Tax Brackets."
    >
      {children}
    </BracketTaxCellTooltip>
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

function EmployerCostColumnInfo({ label, rate }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full text-teal-700 hover:text-teal-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            aria-label={`How ${label} is calculated`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-sm bg-gray-900 text-gray-100 border border-gray-700 p-3 text-left leading-relaxed"
        >
          <p className="font-semibold text-white mb-2">{label}</p>
          <p className="mb-2 text-sm">
            Employer-paid cost for this pay period. It is not withheld from wages.
          </p>
          <ul className="list-disc pl-4 space-y-1 mb-2 text-sm">
            <li>Rate: <strong>{rate}%</strong> of taxable wages this period</li>
            <li>Taxable wages = min(gross pay, remaining wage-base balance)</li>
            <li>Annual wage cap: $7,000 per employee</li>
          </ul>
          <p className="text-gray-300 text-[11px]">
            Not included in Total Deductions. Net pay is unchanged.
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

function isProcessedCutoff(period) {
  return period?.status === 'processed';
}

function isPendingCutoff(period) {
  return period?.status === 'open' || period?.status === 'locked';
}

function initCreateCutoffForm() {
  return {
    departmentId: '',
    periodStart: '',
    periodEnd: '',
    paymentDate: '',
    frequency: 'bi-weekly',
  };
}

const EmployeeSheet = () => {
  const { token } = useAuthStore();
  const companyId = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token)?.companyId || null;
    } catch {
      return null;
    }
  }, [token]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursLoaded, setHoursLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedCutoffId, setSelectedCutoffId] = useState('');
  const [companyTimezone, setCompanyTimezone] = useState('UTC');
  const [cutoffPeriods, setCutoffPeriods] = useState([]);
  const [exportBatchRangeKeys, setExportBatchRangeKeys] = useState(() => new Set());
  const [salaryComputed, setSalaryComputed] = useState(false);
  const [salaryComputing, setSalaryComputing] = useState(false);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [futaSettings, setFutaSettings] = useState({ enabled: false, rate: 7 });
  const [suiSettings, setSuiSettings] = useState({ enabled: false, rate: DEFAULT_SUI_RATE });
  const [ettSettings, setEttSettings] = useState({ enabled: false, rate: DEFAULT_ETT_RATE });
  const [taxRates, setTaxRates] = useState(DEFAULT_TAX_RATES);
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [earningTypes, setEarningTypes] = useState([]);
  const [customDeductionColumns, setCustomDeductionColumns] = useState([]);
  const [deductionInputs, setDeductionInputs] = useState({});
  const [columnHeaderInputs, setColumnHeaderInputs] = useState({});
  const [showAddDeductionColumn, setShowAddDeductionColumn] = useState(false);
  const [newCustomDeduction, setNewCustomDeduction] = useState({ label: '', calculationType: 'fixed' });
  const [checkNumber, setCheckNumber] = useState('');
  const [savedPayrollRunId, setSavedPayrollRunId] = useState(null);
  const [paidEmployeeIds, setPaidEmployeeIds] = useState(() => new Set());
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [payslipLoading, setPayslipLoading] = useState({});
  const [departments, setDepartments] = useState([]);
  const [showCreateCutoffModal, setShowCreateCutoffModal] = useState(false);
  const [createCutoffForm, setCreateCutoffForm] = useState(initCreateCutoffForm);
  const [creatingCutoff, setCreatingCutoff] = useState(false);

  const invalidateSavedPayroll = useCallback(() => {
    setSavedPayrollRunId(null);
    setPaidEmployeeIds(new Set());
  }, []);

  const paidRunIdRef = useRef(savedPayrollRunId);
  paidRunIdRef.current = savedPayrollRunId;

  const refreshPaidEmployees = useCallback(async () => {
    const runId = savedPayrollRunId;
    if (!token || !runId) {
      setPaidEmployeeIds(new Set());
      return;
    }

    try {
      const ids = await fetchPaidEmployeeIdsForPayrollRun(API_URL, token, runId);
      if (paidRunIdRef.current !== runId) return;
      setPaidEmployeeIds(ids);
    } catch {
      if (paidRunIdRef.current !== runId) return;
      setPaidEmployeeIds(new Set());
    }
  }, [token, savedPayrollRunId]);

  useEffect(() => {
    refreshPaidEmployees();
  }, [refreshPaidEmployees]);

  useEffect(() => {
    const onFocus = () => {
      refreshPaidEmployees();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshPaidEmployees]);

  const fetchCutoffPeriods = useCallback(async () => {
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/cutoff-periods?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const periods = res.ok ? data.data || [] : [];
    return periods.sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart));
  }, [token]);

  const fetchExportBatches = useCallback(async () => {
    if (!token || !companyId) return new Set();

    const res = await fetch(
      `${API_URL}/api/payroll-export/batches/${encodeURIComponent(companyId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch payroll export batches');
    }

    const keys = new Set(
      (data.data?.batches || []).map((batch) =>
        periodRangeKey(batch.periodStart, batch.periodEnd)
      )
    );
    return keys;
  }, [token, companyId]);

  const fetchDepartments = useCallback(async () => {
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/departments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    setDepartments(data.data || []);
  }, [token]);

  const refreshCutoffPeriods = useCallback(async () => {
    const [periods, batchKeys] = await Promise.all([
      fetchCutoffPeriods(),
      fetchExportBatches().catch((err) => {
        console.error('Failed to fetch payroll export batches:', err);
        return new Set();
      }),
    ]);
    setCutoffPeriods(periods);
    setExportBatchRangeKeys(batchKeys);
    return periods;
  }, [fetchCutoffPeriods, fetchExportBatches]);

  const fetchHoursForCutoff = useCallback(async (cutoffId) => {
    if (!token || !cutoffId) return { hoursByUserId: {}, summary: null };

    const res = await fetch(
      `${API_URL}/api/payroll-export/by-cutoff-period/${encodeURIComponent(cutoffId)}`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch payroll export hours');
    }

    const employees = data.data?.payload?.employees || [];
    const hoursByUserId = {};
    employees.forEach((emp) => {
      if (!emp.UserID) return;
      hoursByUserId[emp.UserID] = mapPayrollExportEntry(emp);
    });

    const summary = {
      employeeCount: data.data?.employeeCount ?? employees.length,
      totalRegularHours: round2(
        employees.reduce((sum, emp) => sum + (Number(emp.RegularHours) || 0), 0)
      ),
      totalOvertimeHours: round2(
        employees.reduce((sum, emp) => sum + (Number(emp.OTHours) || 0), 0)
      ),
      totalDriverHours: round2(
        employees.reduce((sum, emp) => sum + (Number(emp.DriverHours) || 0), 0)
      ),
      totalTrainingHours: round2(
        employees.reduce((sum, emp) => sum + (Number(emp.TrainingHours) || 0), 0)
      ),
      totalPtoHours: round2(
        employees.reduce((sum, emp) => sum + (Number(emp.PTO) || 0), 0)
      ),
      generatedAt: data.data?.generatedAt ?? data.data?.payload?.generatedAt ?? null,
    };

    return { hoursByUserId, summary };
  }, [token]);

  const mergeHoursIntoRows = useCallback((employeeRows, hoursByUserId) => {
    return employeeRows.map((row) => {
      const hours = hoursByUserId[row.id];
      if (!hours) {
        return {
          ...row,
          regularHours: null,
          overtimeHours: null,
          driverHours: null,
          trainingHours: null,
          ptoHours: null,
          totalPunchHours: null,
        };
      }

      return {
        ...row,
        ...hours,
      };
    });
  }, []);

  const clearHoursFromRows = useCallback((employeeRows) => {
    return employeeRows.map((row) => ({
      ...row,
      regularHours: null,
      overtimeHours: null,
      driverHours: null,
      trainingHours: null,
      ptoHours: null,
      totalPunchHours: null,
    }));
  }, []);

  const clearSalaryFromRows = useCallback((employeeRows) => {
    return employeeRows.map((row) => ({
      ...row,
      grossPay: null,
      taxes: null,
      taxBreakdown: null,
      federalTaxDetail: null,
      stateTaxDetail: null,
      deductions: null,
      netPay: null,
      computeError: null,
      deductionBreakdown: null,
      futaDeduction: null,
      suiDeduction: null,
      ettDeduction: null,
      earningsBreakdown: null,
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
    (
      row,
      inputsByType = {},
      columns = allDeductionColumns,
      futaOverride = futaSettings,
      employerSettings = { sui: suiSettings, ett: ettSettings }
    ) => {
      if (row.grossPay == null || row.taxes == null || row.computeError) {
        return { ...row, suiDeduction: null, ettDeduction: null };
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
        ...employerCostForRow(row, employerSettings.sui, employerSettings.ett),
      };
    },
    [allDeductionColumns, futaSettings, suiSettings, ettSettings]
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
      const taxes = calculateTaxes(employee, row.grossPay, taxRates, companyConfig?.payFrequency);

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
          earningsBreakdown: row.earningsBreakdown || {},
        },
        taxes,
        netPayAfterTaxes: row.netPay,
        suiDeduction: row.suiDeduction ?? null,
        ettDeduction: row.ettDeduction ?? null,
      };
    });

    const hoursData = {};
    eligibleRows.forEach((row) => {
      hoursData[row.id] = {
        regularHours: row.regularHours ?? 0,
        overtimeHours: row.overtimeHours ?? 0,
        driverHours: row.driverHours ?? 0,
        trainingHours: row.trainingHours ?? 0,
        ptoHours: row.ptoHours ?? 0,
        ptoHoursBalance: row.payrollDetails?.ptoHoursBalance ?? 0,
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
    companyConfig,
    dateRange.from,
    dateRange.to,
    earningTypes,
    getEligiblePayrollRows,
    taxRates,
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
      toast.success('Payroll saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save payroll');
    } finally {
      setSavingPayroll(false);
    }
  };

  const runPayslipAction = async (row, action) => {
    if (!row.grossPay || row.computeError) return;

    if (action === 'send') {
      if (!savedPayrollRunId || !paidEmployeeIds.has(String(row.id))) {
        toast.error(UNVERIFIED_PAYMENT_PAYSLIP_MESSAGE);
        return;
      }
      if (!isValidEmployeeEmail(row.email)) {
        toast.error(`${row.name} has no valid email on file`);
        return;
      }
    }

    setPayslipLoading((prev) => ({ ...prev, [row.id]: action }));
    try {
      if (action === 'send') {
        await sendPayslipEmail({
          apiUrl: API_URL,
          token,
          payrollRunId: savedPayrollRunId,
          employeeId: row.id,
        });
        toast.success(`Payslip sent to ${row.email}`);
        return;
      }

      const payrollRunId = await ensurePayrollSaved();
      const params = { apiUrl: API_URL, token, payrollRunId, employeeId: row.id };

      if (action === 'view') {
        await viewPayslipPdf(params);
      } else {
        await downloadPayslipPdf(params);
        toast.success(`Payslip downloaded for ${row.name}`);
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
        driverPayRate: payroll?.driverPayRate ?? null,
        payrollDetails: payroll || null,
        earningRates: detail?.earningRates || {},
        hourlyRate: emp.hourlyRate,
        regularHours: null,
        overtimeHours: null,
        driverHours: null,
        trainingHours: null,
        ptoHours: null,
        totalPunchHours: null,
        grossPay: null,
        taxes: null,
        taxBreakdown: null,
        deductions: null,
        netPay: null,
        computeError: null,
      };
    });
  }, [token]);

  const loadHours = useCallback(async (from, to, currentRows, cutoffId) => {
    if (!cutoffId) {
      toast.error('Select a processed cutoff period before loading hours');
      return;
    }

    const period = cutoffPeriods.find((p) => p.id === cutoffId);
    if (!period || !isProcessedCutoff(period)) {
      toast.error('Hours can only be loaded from processed cutoff periods');
      return;
    }

    if (!from || !to) {
      toast.error('Please select a processed cutoff period');
      return;
    }

    try {
      setHoursLoading(true);
      const { hoursByUserId, summary } = await fetchHoursForCutoff(cutoffId);
      setRows(mergeHoursIntoRows(currentRows, hoursByUserId));
      setHoursLoaded(true);

      if (summary) {
        toast.success(
          `Loaded export for ${summary.employeeCount} employee(s): ${summary.totalRegularHours} regular, ${summary.totalOvertimeHours} OT, ${summary.totalDriverHours} driver, ${summary.totalTrainingHours} training, ${summary.totalPtoHours} PTO (${from} to ${to})`
        );
      } else {
        toast.success(`Hours loaded for ${from} to ${to}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load payroll export hours');
      setHoursLoaded(false);
    } finally {
      setHoursLoading(false);
    }
  }, [cutoffPeriods, fetchHoursForCutoff, mergeHoursIntoRows]);

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
        const [employeeRows, periods, batchKeys, settingsRes] = await Promise.all([
          fetchEmployees(),
          fetchCutoffPeriods(),
          fetchExportBatches().catch((err) => {
            console.error('Failed to fetch payroll export batches:', err);
            toast.error(err.message || 'Failed to load payroll export batches');
            return new Set();
          }),
          fetch(`${API_URL}/api/company-information/company-settings`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .catch(() => null),
          fetchDepartments(),
        ]);

        const tz =
          settingsRes?.data?.company?.timezone ||
          settingsRes?.data?.timezone ||
          settingsRes?.data?.companyTimezone ||
          'UTC';
        setCompanyTimezone(tz);

        setCutoffPeriods(periods);
        setExportBatchRangeKeys(batchKeys);
        setRows(employeeRows);
      } catch (err) {
        toast.error(err.message || 'Failed to initialize sheet');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, companyId]);

  const handleLoadHours = async () => {
    const baseRows = clearSalaryFromRows(clearHoursFromRows(rows));
    setRows(baseRows);
    setHoursLoaded(false);
    setSalaryComputed(false);
    setDeductionInputs({});
    setColumnHeaderInputs({});
    invalidateSavedPayroll();
    await loadHours(dateRange.from, dateRange.to, baseRows, selectedCutoffId);
  };

  const handleComputeSalary = async () => {
    if (!hoursLoaded) {
      toast.warning('Load hours first — hourly employees need punch data for this period.');
    }

    try {
      setSalaryComputing(true);
      invalidateSavedPayroll();

      const [detailsRes, settingsRes, futaRes, flatTaxRatesRes, federalTaxRatesRes, stateTaxRatesRes] = await Promise.all([
        fetch(`${API_URL}/api/employee-payroll-details/employees-with-details`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/company-information/company-settings`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/deductions/settings`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/deductions/tax-rates`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/company-information/federal-tax-rates`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${API_URL}/api/company-information/state-tax-rates`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
      ]);

      const detailsData = await detailsRes.json();
      const settingsData = await settingsRes.json();
      const futaData = await futaRes.json();
      const flatTaxRatesData = await flatTaxRatesRes.json();
      const federalTaxRatesData = await federalTaxRatesRes.json();
      const stateTaxRatesData = await stateTaxRatesRes.json();

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
      const activeSuiSettings = futaRes.ok && futaData.success
        ? {
            enabled: Boolean(futaData.data?.suiEnabled),
            rate: futaData.data?.suiRate ?? DEFAULT_SUI_RATE,
          }
        : { enabled: false, rate: DEFAULT_SUI_RATE };
      const activeEttSettings = futaRes.ok && futaData.success
        ? {
            enabled: Boolean(futaData.data?.ettEnabled),
            rate: futaData.data?.ettRate ?? DEFAULT_ETT_RATE,
          }
        : { enabled: false, rate: DEFAULT_ETT_RATE };
      setFutaSettings(activeFutaSettings);
      setSuiSettings(activeSuiSettings);
      setEttSettings(activeEttSettings);

      const bracketsFailed =
        (!federalTaxRatesRes.ok || !federalTaxRatesData.success) || (!stateTaxRatesRes.ok || !stateTaxRatesData.success);

      if ((!flatTaxRatesRes.ok || !flatTaxRatesData.success) || bracketsFailed) {
        toast.warning('Could not load company tax rates — falling back to defaults for this calculation');
      }

      const mapBrackets = (bracketsData) =>
        (bracketsData || [])
          .filter((bracket) => bracket.enabled !== false)
          .map((bracket) => ({
            filingStatus: bracket.filingStatus,
            minAnnualIncome: bracket.minAnnualIncome,
            maxAnnualIncome: bracket.maxAnnualIncome,
            rate: (bracket.rate ?? 0) / 100,
          }));

      const activeTaxRates = flatTaxRatesRes.ok && flatTaxRatesData.success
        ? {
            ficaRate: (flatTaxRatesData.data?.ficaRate ?? 0) / 100,
            medicareRate: (flatTaxRatesData.data?.medicareRate ?? 0) / 100,
            sdiRate: (flatTaxRatesData.data?.sdiRate ?? 0) / 100,
            ficaWageBase: DEFAULT_TAX_RATES.ficaWageBase,
            federalBrackets: federalTaxRatesRes.ok && federalTaxRatesData.success ? mapBrackets(federalTaxRatesData.data) : [],
            stateBrackets: stateTaxRatesRes.ok && stateTaxRatesData.success ? mapBrackets(stateTaxRatesData.data) : [],
          }
        : DEFAULT_TAX_RATES;
      setTaxRates(activeTaxRates);

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
              federalTaxDetail: null,
              stateTaxDetail: null,
              deductions: null,
              netPay: null,
              computeError: 'no_profile',
              deductionBreakdown: null,
              futaDeduction: null,
              suiDeduction: null,
              ettDeduction: null,
              earningsBreakdown: null,
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
              driverHours: row.driverHours ?? 0,
              trainingHours: row.trainingHours ?? 0,
              ptoHours: row.ptoHours ?? 0,
            },
            payFrequency,
            taxRates: activeTaxRates,
          });

          if (result.error) {
            skippedCount++;
            return {
              ...row,
              payrollDetails: detail.payrollDetails,
              earningRates: detail.earningRates || {},
              payType: detail.payrollDetails.payType,
              payRate: detail.payrollDetails.payRate,
              driverPayRate: detail.payrollDetails.driverPayRate,
              grossPay: null,
              taxes: null,
              taxBreakdown: null,
              federalTaxDetail: null,
              stateTaxDetail: null,
              deductions: null,
              netPay: null,
              computeError: result.error,
              deductionBreakdown: null,
              futaDeduction: null,
              suiDeduction: null,
              ettDeduction: null,
              earningsBreakdown: null,
            };
          }

          computedCount++;

          const taxBreakdown = calculateTaxes(employee, result.grossPay, activeTaxRates, payFrequency);
          const federalTaxDetail = getFederalTaxDetail(
            employee,
            result.grossPay,
            activeTaxRates.federalBrackets,
            payFrequency
          );
          const stateTaxDetail = getStateTaxDetail(
            employee,
            result.grossPay,
            activeTaxRates.stateBrackets,
            payFrequency
          );

          const baseRow = {
            ...row,
            payrollDetails: detail.payrollDetails,
            earningRates: detail.earningRates || {},
            payType: detail.payrollDetails.payType,
            payRate: detail.payrollDetails.payRate,
            driverPayRate: detail.payrollDetails.driverPayRate,
            grossPay: result.grossPay,
            taxes: taxBreakdown.totalTaxes,
            taxBreakdown,
            federalTaxDetail,
            stateTaxDetail,
            earningsBreakdown: result.earningsBreakdown || {},
            computeError: null,
          };

          const rowInputs = {};
          allTypes.forEach((dt) => {
            rowInputs[dt.id] = columnHeaderInputs[dt.id] ?? deductionInputs[row.id]?.[dt.id] ?? '';
          });
          rebuiltInputs[row.id] = rowInputs;

          return applyDeductionsToRow(baseRow, rowInputs, allTypes, activeFutaSettings, {
            sui: activeSuiSettings,
            ett: activeEttSettings,
          });
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

  const handleCreateCutoff = async () => {
    const { periodStart, periodEnd, paymentDate } = createCutoffForm;
    if (!periodStart || !periodEnd || !paymentDate) {
      toast.error('Please fill in period start, end, and payment date');
      return;
    }

    if (new Date(periodStart) > new Date(periodEnd)) {
      toast.error('Period start must be before or equal to period end');
      return;
    }

    try {
      setCreatingCutoff(true);
      const res = await fetch(`${API_URL}/api/cutoff-periods/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createCutoffForm,
          departmentId: createCutoffForm.departmentId || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create cutoff period');
      }

      toast.success('Cutoff period created — review and process it before loading hours');
      setShowCreateCutoffModal(false);
      setCreateCutoffForm(initCreateCutoffForm());
      await refreshCutoffPeriods();
    } catch (err) {
      toast.error(err.message || 'Failed to create cutoff period');
    } finally {
      setCreatingCutoff(false);
    }
  };

  const handleSelectCutoff = (cutoffId) => {
    if (!cutoffId) return;
    const period = cutoffPeriods.find((p) => p.id === cutoffId);
    if (!period || !isProcessedCutoff(period)) {
      toast.error('Select a processed cutoff period');
      return;
    }

    const from = toLocalDateStr(period.periodStart, companyTimezone);
    const to = toLocalDateStr(period.periodEnd, companyTimezone);

    setSelectedCutoffId(cutoffId);
    setDateRange({ from, to });
    setHoursLoaded(false);
    setSalaryComputed(false);
    setDeductionInputs({});
    setColumnHeaderInputs({});
    invalidateSavedPayroll();
    setRows((prev) => clearSalaryFromRows(clearHoursFromRows(prev)));
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
      await refreshCutoffPeriods();
      if (selectedCutoffId) {
        await loadHours(dateRange.from, dateRange.to, employeeRows, selectedCutoffId);
      }
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

  const processedCutoffPeriods = useMemo(() => {
    const withExport = cutoffPeriods.filter((period) => {
      if (!isProcessedCutoff(period)) return false;
      return exportBatchRangeKeys.has(periodRangeKey(period.periodStart, period.periodEnd));
    });
    const unique = dedupeCutoffPeriodsByRange(withExport, companyTimezone);
    return unique.sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart));
  }, [cutoffPeriods, companyTimezone, exportBatchRangeKeys]);

  useEffect(() => {
    if (!selectedCutoffId) return;
    const stillAvailable = processedCutoffPeriods.some((p) => p.id === selectedCutoffId);
    if (!stillAvailable) {
      setSelectedCutoffId('');
      setDateRange({ from: '', to: '' });
      setHoursLoaded(false);
    }
  }, [processedCutoffPeriods, selectedCutoffId]);

  const pendingCutoffPeriods = useMemo(() => {
    const unique = dedupeCutoffPeriodsByRange(
      cutoffPeriods.filter(isPendingCutoff),
      companyTimezone,
    );
    return unique.sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart));
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
      if (suiSettings.enabled) cols.push(SUI_EMPLOYER_COLUMN);
      if (ettSettings.enabled) cols.push(ETT_EMPLOYER_COLUMN);
      cols.push({ key: 'actions', label: 'Payslip', align: 'center', isActions: true });
    }
    return cols;
  }, [hoursLoaded, salaryComputed, allDeductionColumns, futaSettings.enabled, suiSettings.enabled, ettSettings.enabled]);

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

    return [...result].sort((a, b) => {
      const byLast = getLastNameSortKey(a.name).localeCompare(getLastNameSortKey(b.name), undefined, {
        sensitivity: 'base',
      });
      if (byLast !== 0) return byLast;
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
  }, [rows, search, statusFilter]);

  const handleProcessPayrollReport = async () => {
    const eligible = getEligiblePayrollRows();
    if (eligible.length === 0) {
      toast.error('Compute salary first — no employees with pay data to process');
      return;
    }

    try {
      setSavingPayroll(true);
      await savePayrollFromSheet();
      toast.success(`Payroll report processed for ${eligible.length} employee(s)`);
    } catch (err) {
      console.error('Process payroll report error:', err);
      toast.error(err.message || 'Failed to process payroll report');
    } finally {
      setSavingPayroll(false);
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
        if (row.driverHours != null) acc.driver += row.driverHours;
        if (row.trainingHours != null) acc.training += row.trainingHours;
        if (row.ptoHours != null) acc.pto += row.ptoHours;
        return acc;
      },
      { totalPunch: 0, regular: 0, ot: 0, driver: 0, training: 0, pto: 0 }
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
        if (row.suiDeduction != null) acc.sui += row.suiDeduction;
        if (row.ettDeduction != null) acc.ett += row.ettDeduction;
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
      { gross: 0, taxes: 0, deductions: 0, net: 0, futa: 0, sui: 0, ett: 0, deductionTotals, taxTotals }
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
        Name: formatNameLastFirst(row.name),
        Email: row.email,
        'Employee ID': row.employeeId,
        Department: row.departmentName,
        Position: row.position,
        Status: row.status,
        'Pay Rate': formatPayRate(row.payType, row.payRate),
        'Driver Rate': formatLegacyRate(row.driverPayRate),
      };

      if (hoursLoaded) {
        base['Regular Hrs'] = formatHours(row.regularHours);
        base['OT Hrs'] = formatHours(row.overtimeHours);
        base['Driver Hrs'] = formatHours(row.driverHours);
        base['Training Hrs'] = formatHours(row.trainingHours);
        base.PTO = formatHours(row.ptoHours);
        base['Total Punch Hrs'] = formatHours(row.totalPunchHours);
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
        if (suiSettings.enabled) {
          base['CA SUI (employer)'] = formatCurrency(row.suiDeduction);
        }
        if (ettSettings.enabled) {
          base['CA ETT (employer)'] = formatCurrency(row.ettDeduction);
        }
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
      case 'name':
        return formatNameLastFirst(row.name);
      case 'payRate':
        return formatPayRate(row.payType, row.payRate);
      case 'driverPayRate':
        return formatLegacyRate(row.driverPayRate);
      case 'hourlyRate':
        return formatLegacyRate(row.hourlyRate);
      case 'payType':
        return row.payType === '—' ? '—' : row.payType.toUpperCase();
      case 'regularHours':
      case 'overtimeHours':
      case 'driverHours':
      case 'trainingHours':
      case 'ptoHours':
      case 'totalPunchHours':
        return formatHours(row[key]);
      case 'grossPay':
      case 'taxes':
      case 'deductions':
      case 'netPay':
        if (row.computeError === 'no_pay_rate') return 'No rate';
        if (row.computeError === 'no_profile') return '—';
        return formatCurrency(row[key]);
      case 'futaDeduction':
      case 'suiDeduction':
      case 'ettDeduction':
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
      <div className="p-2 sm:p-4 lg:p-6 min-w-0">
        {/* Payroll workflow — steps 1–3 */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm min-w-0">
          <div className="px-3 sm:px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-semibold text-gray-800">Payroll workflow</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Load hours for the period, compute salaries, then process the payroll report
            </p>
          </div>

          {/* Step 1 — period & hours */}
          <div className="p-3 sm:p-4 bg-blue-50/60 border-b border-blue-100">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold text-white">
                1
              </span>
              <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                Load hours
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
              <div className="w-full sm:w-auto min-w-0">
                <label className="block text-xs font-medium text-blue-700 mb-1">Processed cutoff</label>
                <select
                  value={selectedCutoffId}
                  onChange={(e) => handleSelectCutoff(e.target.value)}
                  className="w-full sm:min-w-[240px] px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    {processedCutoffPeriods.length > 0
                      ? 'Select processed cutoff...'
                      : 'No cutoffs with a payroll export yet'}
                  </option>
                  {processedCutoffPeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {formatCutoffRangeLabel(period, companyTimezone)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">From</label>
                  <input
                    type="date"
                    value={dateRange.from}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-blue-50 text-blue-900 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">To</label>
                  <input
                    type="date"
                    value={dateRange.to}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-blue-50 text-blue-900 cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowCreateCutoffModal(true)}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4" />
                  Create Cutoff
                </button>
                <button
                  onClick={handleLoadHours}
                  disabled={hoursLoading || !selectedCutoffId || !dateRange.from || !dateRange.to}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock className="w-4 h-4" />
                  {hoursLoading ? 'Loading...' : hoursLoaded ? 'Reload Hours' : 'Load Hours'}
                </button>
              </div>
            </div>
            {pendingCutoffPeriods.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                <p className="text-xs font-semibold text-amber-900 mb-2">
                  Pending cutoffs — review punches and mark as processed before loading hours
                </p>
                <ul className="space-y-1.5">
                  {pendingCutoffPeriods.slice(0, 5).map((period) => (
                    <li key={period.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-amber-900">
                        {formatCutoffRangeLabel(period, companyTimezone)}
                        <span className="ml-2 capitalize text-amber-700">({period.status})</span>
                      </span>
                      <Link
                        href={`/dashboard/company/cutoff-periods/${period.id}/review`}
                        className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900"
                      >
                        Review &amp; process
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!selectedCutoffId && processedCutoffPeriods.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Only periods with a payroll export appear here. Create a cutoff, review punches, mark
                it processed (to generate the export), then load hours.
              </p>
            )}
            {!selectedCutoffId && processedCutoffPeriods.length > 0 && (
              <p className="mt-2 text-xs text-blue-700">
                Select a processed cutoff with a payroll export, then load hours for that pay window.
              </p>
            )}
            {hoursLoaded && !hoursLoading && selectedCutoffId && (
              <p className="mt-2 text-xs text-blue-700">
                Hours loaded from processed cutoff {dateRange.from} to {dateRange.to} — active employees
                &amp; supervisors only (OT includes approved hours only)
              </p>
            )}
          </div>

          {/* Steps 2–3 — compute & process report */}
          <div className="p-3 sm:p-4 flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-3 md:gap-4">
            <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-2 w-full md:w-auto min-w-0">
              <div className="flex items-center gap-2 w-full md:w-auto min-w-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-600 text-[10px] font-bold text-white shrink-0">
                  2
                </span>
                <button
                  onClick={handleComputeSalary}
                  disabled={salaryComputing || loading || !dateRange.from || !dateRange.to}
                  className="inline-flex flex-1 min-w-0 md:flex-initial items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Calculator className="w-4 h-4 shrink-0" />
                  {salaryComputing ? 'Computing...' : salaryComputed ? 'Recompute Salary' : 'Compute Salary'}
                </button>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-300 hidden md:block self-center" aria-hidden />

              <div className="flex items-center gap-2 w-full md:w-auto min-w-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-[10px] font-bold text-white shrink-0">
                  3
                </span>
                <button
                  onClick={handleProcessPayrollReport}
                  disabled={!salaryComputed || savingPayroll}
                  className="inline-flex flex-1 min-w-0 md:flex-initial items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  {savingPayroll
                    ? 'Processing...'
                    : savedPayrollRunId
                      ? 'Reprocess Payroll Report'
                      : 'Process Payroll Report'}
                </button>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 w-full md:w-auto px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  aria-label="More payroll actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  More
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {salaryComputed && (
                  <>
                    <DropdownMenuItem
                      onClick={handleSavePayroll}
                      disabled={savingPayroll}
                    >
                      <Save className="text-indigo-600" />
                      {savingPayroll ? 'Saving...' : savedPayrollRunId ? 'Re-save Payroll' : 'Save Payroll'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowAddDeductionColumn(true)}>
                      <Plus className="text-red-600" />
                      Add Deduction Column
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={exportToExcel} disabled={filteredRows.length === 0}>
                  <Download className="text-green-600" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleRefresh}
                  disabled={loading || hoursLoading || salaryComputing}
                >
                  <RefreshCw className="text-gray-600" />
                  Refresh Data
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {salaryComputed && companyConfig && (
          <div className="mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-800">
                  Payroll computed — {companyConfig.companyName}
                </p>
                <p className="text-xs text-green-700 mt-0.5 break-words">
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
                  {suiSettings.enabled && (
                    <>
                      {' · '}
                      CA SUI <span className="font-medium">{suiSettings.rate}%</span> employer cost
                    </>
                  )}
                  {ettSettings.enabled && (
                    <>
                      {' · '}
                      CA ETT <span className="font-medium">{ettSettings.rate}%</span> employer cost
                    </>
                  )}
                  {(suiSettings.enabled || ettSettings.enabled) && (
                    <>
                      {' '}
                      (not deducted from net)
                    </>
                  )}
                  {savedPayrollRunId && (
                    <>
                      {' · '}
                      <span className="font-medium">Payroll report processed</span>
                    </>
                  )}
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs text-green-700 uppercase tracking-wide">Total Net Payroll</p>
                <p className="text-xl sm:text-2xl font-bold text-green-800">{formatCurrency(salaryTotals.net)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Table filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All ({statusCounts.all})</option>
            <option value="active">Active ({statusCounts.active})</option>
            <option value="inactive">Inactive ({statusCounts.inactive})</option>
            <option value="deleted">Deleted ({statusCounts.deleted})</option>
          </select>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span>
              {filteredRows.length} of {rows.length} rows
            </span>
            {hoursLoaded && !hoursLoading && (
              <span className="font-medium text-green-700">
                Σ {hoursTotals.totalPunch.toFixed(2)} total punch hrs
              </span>
            )}
            {salaryComputed && !salaryComputing && (
              <span className="font-medium text-orange-700">
                Σ {formatCurrency(salaryTotals.gross)} gross
              </span>
            )}
          </div>
        </div>

        {/* Spreadsheet — horizontal scroll on mobile; sticky name col kept for desktop usability */}
        <p className="sm:hidden text-xs text-gray-500 mb-2">
          Swipe sideways to see all columns
        </p>
        <div className="border border-gray-400 rounded-lg overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-340px)] overscroll-x-contain">
            <table className="w-full border-collapse text-sm min-w-[1600px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#f3f3f3]">
                  <th className={`sm:sticky ${STICKY_ROW_NUM_LEFT} z-40 min-w-[48px] px-2 py-2 text-center text-xs font-semibold text-gray-600 border border-gray-300 bg-[#e8e8e8] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}>
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
                          ? `sm:sticky ${STICKY_NAME_LEFT} z-30 min-w-[150px] bg-[#f3f3f3] shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]`
                          : ''
                      } ${col.isDeductionInput ? 'bg-red-50 text-red-800 min-w-[110px]' : ''} ${
                        col.isActions ? 'sm:sticky right-0 z-30 bg-violet-50 text-violet-800 min-w-[120px]' : ''
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
                          <TaxColumnInfo taxRates={taxRates} />
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
                      ) : col.isEmployerCost ? (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            col.align === 'right' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {col.label}
                          <EmployerCostColumnInfo
                            label={col.label}
                            rate={col.key === 'suiDeduction' ? suiSettings.rate : ettSettings.rate}
                          />
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
                        className={`sm:sticky ${STICKY_ROW_NUM_LEFT} z-20 px-2 py-1.5 text-center text-xs font-mono text-gray-500 border border-gray-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                          index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
                        }`}
                      >
                        {index + 1}
                      </td>
                      {sheetColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-1.5 border border-gray-300 whitespace-nowrap ${
                            ['employeeId', 'payRate', 'driverPayRate', 'regularHours', 'overtimeHours', 'driverHours', 'trainingHours', 'ptoHours', 'totalPunchHours', 'grossPay', 'taxes', 'deductions', 'netPay', 'futaDeduction', 'suiDeduction', 'ettDeduction', ...TAX_COLUMNS.map((c) => c.key)].includes(col.key)
                              ? 'font-mono text-xs'
                              : 'text-sm'
                          } ${col.key === 'name' ? 'font-medium text-gray-900' : 'text-gray-700'} ${
                            col.key === 'name'
                              ? `sm:sticky ${STICKY_NAME_LEFT} z-10 min-w-[150px] shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)] ${
                                  index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
                                }`
                              : ''
                          } ${
                            col.key === 'totalPunchHours' && row.totalPunchHours != null ? 'font-semibold text-green-700 bg-green-50/50' : ''
                          } ${col.key === 'netPay' && row.netPay != null ? 'font-semibold text-orange-700 bg-orange-50/50' : ''} ${
                            col.key === 'futaDeduction' && row.futaDeduction != null ? 'font-semibold text-red-700 bg-red-50/50' : ''
                          } ${
                            col.isEmployerCost && row[col.key] != null ? 'font-semibold text-teal-800 bg-teal-50/50' : ''
                          } ${
                            col.isActions ? 'sm:sticky right-0 z-10 bg-inherit' : ''
                          }`}
                          style={{ textAlign: col.align }}
                        >
                          {col.isActions ? (
                            <PayslipActionButtons
                              disabled={!row.grossPay || !!row.computeError}
                              sendDisabled={
                                !paidEmployeeIds.has(String(row.id)) || !isValidEmployeeEmail(row.email)
                              }
                              sendDisabledReason={
                                !paidEmployeeIds.has(String(row.id))
                                  ? 'Verify payment in Disbursement first'
                                  : !isValidEmployeeEmail(row.email)
                                    ? 'No email on file'
                                    : undefined
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
                          ) : col.key === 'federalTax' && row.federalTaxDetail ? (
                            <FederalTaxCellTooltip detail={row.federalTaxDetail}>
                              {cellValue(row, col.key)}
                            </FederalTaxCellTooltip>
                          ) : col.key === 'stateTax' && row.stateTaxDetail ? (
                            <StateTaxCellTooltip detail={row.stateTaxDetail}>
                              {cellValue(row, col.key)}
                            </StateTaxCellTooltip>
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
                    <td className={`sm:sticky ${STICKY_ROW_NUM_LEFT} z-30 px-2 py-2 text-xs font-bold text-gray-700 border border-gray-300 bg-gray-200 text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}>
                      Σ
                    </td>
                    {sheetColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2 text-xs font-bold text-gray-800 border border-gray-300 font-mono ${
                          col.key === 'name'
                            ? `sm:sticky ${STICKY_NAME_LEFT} z-20 min-w-[150px] bg-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]`
                            : ''
                        }`}
                        style={{ textAlign: col.align }}
                      >
                        {col.key === 'regularHours' && formatHours(hoursTotals.regular)}
                        {col.key === 'overtimeHours' && formatHours(hoursTotals.ot)}
                        {col.key === 'driverHours' && formatHours(hoursTotals.driver)}
                        {col.key === 'trainingHours' && formatHours(hoursTotals.training)}
                        {col.key === 'ptoHours' && formatHours(hoursTotals.pto)}
                        {col.key === 'totalPunchHours' && formatHours(hoursTotals.totalPunch)}
                        {col.key === 'grossPay' && formatCurrency(salaryTotals.gross)}
                        {col.isDeductionInput &&
                          formatCurrency(salaryTotals.deductionTotals[col.deductionType.id] ?? 0)}
                        {col.isTax && formatCurrency(salaryTotals.taxTotals[col.breakdownKey] ?? 0)}
                        {col.isTaxTotal && formatCurrency(salaryTotals.taxes)}
                        {col.key === 'deductions' && formatCurrency(salaryTotals.deductions)}
                        {col.key === 'netPay' && formatCurrency(salaryTotals.net)}
                        {col.key === 'futaDeduction' && formatCurrency(salaryTotals.futa)}
                        {col.key === 'suiDeduction' && formatCurrency(salaryTotals.sui)}
                        {col.key === 'ettDeduction' && formatCurrency(salaryTotals.ett)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          1) Select a processed cutoff and Load Hours · 2) Compute Salary · 3) Process payroll report · 4) Export{' '}
          <strong>Payroll Summary</strong> from the Reports tab or use row <strong>Payslip</strong> actions.
        </p>

        {showCreateCutoffModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                  if (creatingCutoff) return;
                  setShowCreateCutoffModal(false);
                  setCreateCutoffForm(initCreateCutoffForm());
                }}
              />
              <div className="relative bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
                <h3 className="text-xl font-bold mb-1 text-gray-900">Create Cutoff Period</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Creates an open cutoff for punch review. After processing, it will appear in the
                  processed cutoff dropdown for loading hours.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department (optional)
                    </label>
                    <select
                      value={createCutoffForm.departmentId}
                      onChange={(e) =>
                        setCreateCutoffForm((prev) => ({ ...prev, departmentId: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Company-wide (all departments)</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Period start</label>
                      <input
                        type="date"
                        value={createCutoffForm.periodStart}
                        onChange={(e) =>
                          setCreateCutoffForm((prev) => ({ ...prev, periodStart: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Period end</label>
                      <input
                        type="date"
                        value={createCutoffForm.periodEnd}
                        onChange={(e) =>
                          setCreateCutoffForm((prev) => ({ ...prev, periodEnd: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment date</label>
                      <input
                        type="date"
                        value={createCutoffForm.paymentDate}
                        onChange={(e) =>
                          setCreateCutoffForm((prev) => ({ ...prev, paymentDate: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                      <select
                        value={createCutoffForm.frequency}
                        onChange={(e) =>
                          setCreateCutoffForm((prev) => ({ ...prev, frequency: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="bi-weekly">Bi-Weekly</option>
                        <option value="bi-monthly">Bi-Monthly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCreateCutoff}
                    disabled={creatingCutoff}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creatingCutoff ? 'Creating...' : 'Create Cutoff'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateCutoffModal(false);
                      setCreateCutoffForm(initCreateCutoffForm());
                    }}
                    disabled={creatingCutoff}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

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
