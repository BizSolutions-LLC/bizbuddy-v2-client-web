'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAuthStore from '@/store/useAuthStore';
import { isMockPayrollId } from '@/lib/mockPayrollData';
import {
  calculateGrossEarnings,
  getSalaryPerPeriod,
  round2,
} from '@/lib/payrollCompute';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const TAX_FIELDS = [
  { key: 'federalTax', label: 'Federal Income Tax' },
  { key: 'stateTax', label: 'State Income Tax' },
  { key: 'fica', label: 'FICA' },
  { key: 'medicare', label: 'Medicare' },
  { key: 'sdi', label: 'SDI' },
  { key: 'calSavers', label: 'CalSavers' },
];

const FALLBACK_EARNING_TYPES = [
  { id: 'regular_hours', code: 'regular_hours', label: 'Regular', calculationType: 'hourly' },
  { id: 'salary', code: 'salary', label: 'Salary', calculationType: 'flat' },
  { id: 'overtime', code: 'overtime', label: 'Overtime', calculationType: 'hourly_ot', otMultiplier: 1.5 },
  { id: 'pto', code: 'pto', label: 'PTO', calculationType: 'hourly' },
  { id: 'driver', code: 'driver', label: 'Drivers/Aides Wages', calculationType: 'hourly' },
  { id: 'training', code: 'training', label: 'Training', calculationType: 'hourly' },
];

const FALLBACK_DEDUCTION_TYPES = [
  { id: '401k', code: '401k', label: '401K' },
  { id: 'benefits', code: 'benefits', label: 'Employee Benefits' },
  { id: 'advances', code: 'advances', label: 'Employee Advances' },
  { id: 'officer_advances', code: 'officer_advances', label: "Officer's Advances" },
  { id: 'garnishment', code: 'garnishment', label: 'Garnishment' },
  { id: 'ded5', code: 'ded5', label: 'Ded 5' },
];

function toInputDate(value) {
  if (!value) return '';
  return String(value).split('T')[0];
}

function formatAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function enabledTypes(types) {
  return (types || []).filter((t) => t.enabled !== false);
}

function lookupBreakdown(breakdown, type) {
  if (!breakdown || typeof breakdown !== 'object' || !type) return 0;
  if (breakdown[type.id] != null && breakdown[type.id] !== '') {
    const byId = Number(breakdown[type.id]);
    if (Number.isFinite(byId)) return byId;
  }
  if (type.code && breakdown[type.code] != null && breakdown[type.code] !== '') {
    const byCode = Number(breakdown[type.code]);
    if (Number.isFinite(byCode)) return byCode;
  }
  return 0;
}

function typesFromBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return [];
  return Object.keys(breakdown)
    .filter((id) => !String(id).startsWith('__fallback_'))
    .map((id) => ({ id, label: id, code: id }));
}

function resolveTypes(configured, breakdown, fallback) {
  const types = enabledTypes(configured);
  if (types.length > 0) return types;
  const fromBreakdown = typesFromBreakdown(breakdown);
  if (fromBreakdown.length > 0) return fromBreakdown;
  return fallback;
}

function taxValue(taxes, key) {
  if (!taxes || typeof taxes !== 'object') return 0;
  const num = Number(taxes[key]);
  return Number.isFinite(num) ? num : 0;
}

function normalizeCode(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function typeText(type) {
  return `${normalizeCode(type?.code)} ${normalizeCode(type?.id)} ${normalizeCode(type?.label)}`;
}

function isRegularType(type) {
  const text = typeText(type);
  return text.includes('regular_hours') || text.includes('regular');
}

function isSalaryType(type) {
  return typeText(type).includes('salary');
}

function isOvertimeType(type) {
  const text = typeText(type);
  return text.includes('overtime') || text.includes('hourly_ot') || text.split(/\s+/).includes('ot');
}

function isDriverType(type) {
  const text = typeText(type);
  return text.includes('driver') || text.includes('aide');
}

function isPtoType(type) {
  return typeText(type).includes('pto');
}

function isTrainingType(type) {
  return typeText(type).includes('training');
}

function employeeGross(employee) {
  const num = Number(employee?.grossPay ?? employee?.calculated?.grossEarnings);
  return Number.isFinite(num) ? num : 0;
}

function employeePayType(employee) {
  return normalizeCode(employee?.payType || employee?.payrollDetails?.payType);
}

function firstNumber(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function firstPositive(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

function collectHours(employee, report, clockHours) {
  const id = employee?.employeeId || employee?.id;
  const saved = report?.hoursData?.[id] || report?.hoursData?.[employee?.employeeId] || {};
  const nested = employee?.hours || {};
  const clock = clockHours || {};

  return {
    regularHours: firstNumber(saved.regularHours, employee?.regularHours, nested.regularHours, clock.regularHours),
    overtimeHours: firstNumber(saved.overtimeHours, employee?.overtimeHours, nested.overtimeHours, clock.overtimeHours),
    driverHours: firstNumber(
      saved.driverHours,
      employee?.driverHours,
      nested.driverHours,
      clock.driverHours
    ),
    trainingHours: firstNumber(
      saved.trainingHours,
      employee?.trainingHours,
      nested.trainingHours,
      clock.trainingHours
    ),
    ptoHours: firstNumber(saved.ptoHours, employee?.ptoHours, nested.ptoHours, clock.ptoHours),
  };
}

function mapClockEmployee(empClock) {
  return {
    regularHours: firstNumber(empClock.regularHours, empClock.RegularHours),
    overtimeHours: firstNumber(
      empClock.approvedOvertimeHours,
      empClock.overtimeHours,
      empClock.OTHours
    ),
    driverHours: firstNumber(
      empClock.driverHours,
      empClock.DriverHours,
      empClock.driverAideHours,
      empClock.aideHours,
      empClock.approvedDriverHours
    ),
    trainingHours: firstNumber(empClock.trainingHours, empClock.TrainingHours),
    ptoHours: firstNumber(empClock.ptoHours, empClock.PTO, empClock.pto),
  };
}

function valueFromComputed(type, breakdown) {
  const direct = lookupBreakdown(breakdown, type);
  if (direct) return direct;
  if (isDriverType(type)) return firstNumber(breakdown?.__fallback_driver);
  if (isSalaryType(type)) return firstNumber(breakdown?.__fallback_salary);
  if (isRegularType(type)) return firstNumber(breakdown?.__fallback_regular);
  if (isOvertimeType(type)) return firstNumber(breakdown?.__fallback_overtime);
  if (isPtoType(type)) return firstNumber(breakdown?.__fallback_pto);
  return 0;
}

function applyGrossRemainder(rows, employee) {
  const gross = employeeGross(employee);
  if (gross <= 0) return rows;

  const assigned = round2(rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0));
  const remainder = round2(gross - assigned);
  const payType = employeePayType(employee);
  const driverRate = firstNumber(
    employee?.driverPayRate,
    employee?.payrollDetails?.driverPayRate
  );

  if (remainder > 0.009) {
    const targetIndex = rows.findIndex((row) => {
      if (driverRate > 0 && isDriverType(row) && row.value === 0) return true;
      if (payType === 'salary' && isSalaryType(row) && row.value === 0) return true;
      if (payType !== 'salary' && isRegularType(row) && row.value === 0) return true;
      return false;
    });
    if (targetIndex >= 0) {
      return rows.map((row, index) => (
        index === targetIndex ? { ...row, value: remainder } : row
      ));
    }
    return rows;
  }

  if (remainder >= -0.009) return rows;

  return rows;
}

function ReadOnlyField({ id, label, value, disabled = false, type = 'text' }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        readOnly
        disabled={disabled}
        tabIndex={-1}
        className={disabled ? 'bg-muted' : 'bg-background'}
      />
    </div>
  );
}

const ViewPaycheckModal = ({ open, onClose, report, employee }) => {
  const { token } = useAuthStore();
  const [enrichment, setEnrichment] = useState(null);

  const employeeName = employee?.employeeName || employee?.name || '—';

  useEffect(() => {
    if (!open || !employee || !report) {
      setEnrichment(null);
      return undefined;
    }

    if (report.isMock || isMockPayrollId(report.id)) {
      setEnrichment({ skipFetch: true });
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const periodStart = toInputDate(report.periodStart);
      const periodEnd = toInputDate(report.periodEnd);
      const headers = { Authorization: `Bearer ${token}` };
      const employeeId = employee.employeeId || employee.id;

      try {
        const [detailsRes, settingsRes, hoursRes] = await Promise.all([
          fetch(`${API_URL}/api/employee-payroll-details/employees-with-details`, { headers }),
          fetch(`${API_URL}/api/company-information/company-settings`, { headers }),
          periodStart && periodEnd
            ? fetch(
                `${API_URL}/api/payroll-system/import-clock-hours?from=${periodStart}&to=${periodEnd}`,
                { headers }
              )
            : Promise.resolve(null),
        ]);

        const detailsJson = await detailsRes.json();
        const settingsJson = await settingsRes.json();
        const hoursJson = hoursRes ? await hoursRes.json() : null;

        if (cancelled) return;

        const detailsEmployees = detailsJson?.data?.employees || [];
        const matched = detailsEmployees.find((emp) => emp.id === employeeId);
        const clockList = hoursJson?.data?.employees || [];
        const clockMatch = clockList.find((emp) => emp.userId === employeeId || emp.id === employeeId);

        setEnrichment({
          payrollDetails: matched?.payrollDetails || null,
          earningRates: matched?.earningRates || {},
          earningTypes: detailsJson?.data?.earningTypes || [],
          deductionTypes: detailsJson?.data?.deductionTypes || [],
          payFrequency: settingsJson?.data?.payrollConfig?.payFrequency || 'biweekly',
          clockHours: clockMatch ? mapClockEmployee(clockMatch) : null,
        });
      } catch (error) {
        console.error('Failed to enrich paycheck breakdown:', error);
        if (!cancelled) setEnrichment({ skipFetch: true });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, employee, report, token]);

  const mergedEmployee = useMemo(() => {
    if (!employee) return null;
    const reportType = employee.payType || employee.payrollDetails?.payType;
    const detailsType = enrichment?.payrollDetails?.payType;
    const payType = [reportType, detailsType].some((type) => normalizeCode(type) === 'salary')
      ? 'salary'
      : (reportType || detailsType);

    const payrollDetails = {
      ...(enrichment?.payrollDetails || {}),
      ...(employee.payrollDetails || {}),
      payType,
      payRate: employee.payRate ?? employee.payrollDetails?.payRate ?? enrichment?.payrollDetails?.payRate,
      driverPayRate:
        employee.driverPayRate ??
        employee.payrollDetails?.driverPayRate ??
        enrichment?.payrollDetails?.driverPayRate,
    };
    return {
      ...employee,
      payrollDetails,
      payType: payrollDetails.payType,
      payRate: payrollDetails.payRate,
      driverPayRate: payrollDetails.driverPayRate,
      earningRates: employee.earningRates || enrichment?.earningRates || {},
    };
  }, [employee, enrichment]);

  const payType = employeePayType(mergedEmployee);

  const earningRows = useMemo(() => {
    if (!mergedEmployee) return [];

    const savedBreakdown =
      mergedEmployee.calculated?.earningsBreakdown || mergedEmployee.earningsBreakdown || {};
    const types = resolveTypes(
      report?.earningTypes || enrichment?.earningTypes,
      savedBreakdown,
      FALLBACK_EARNING_TYPES
    );
    const hours = collectHours(mergedEmployee, report, enrichment?.clockHours);
    const computeEmployee = {
      payrollDetails: mergedEmployee.payrollDetails,
      earningRates: mergedEmployee.earningRates || {},
    };

    let computedBreakdown = {};
    try {
      const result = calculateGrossEarnings(
        computeEmployee,
        types,
        hours,
        enrichment?.payFrequency || 'biweekly'
      );
      computedBreakdown = result?.earningsBreakdown || {};
    } catch (error) {
      console.error('Failed to compute paycheck earnings:', error);
    }

    let rows = types.map((et) => {
      const saved = lookupBreakdown(savedBreakdown, et);
      const computed = valueFromComputed(et, computedBreakdown);

      return {
        id: et.id,
        label: et.label || et.code || et.id,
        code: et.code,
        value: saved || computed || 0,
      };
    });

    if (!rows.some(isSalaryType)) {
      rows.splice(1, 0, { ...FALLBACK_EARNING_TYPES[1], value: 0 });
    }

    if (payType === 'salary') {
      rows = rows.map((row) => (
        isRegularType(row) || isOvertimeType(row) ? { ...row, value: 0 } : row
      ));

      const salaryIndex = rows.findIndex(isSalaryType);
      const otherEarnings = rows.reduce((sum, row, index) => (
        index === salaryIndex ? sum : sum + (Number(row.value) || 0)
      ), 0);
      const periodSalary = getSalaryPerPeriod(
        mergedEmployee.payrollDetails?.payRate,
        enrichment?.payFrequency || 'biweekly'
      );
      const salaryValue = firstPositive(
        rows[salaryIndex]?.value,
        periodSalary,
        round2(Math.max(0, employeeGross(mergedEmployee) - otherEarnings)),
        employeeGross(mergedEmployee)
      );

      if (salaryIndex >= 0) {
        rows[salaryIndex] = { ...rows[salaryIndex], value: salaryValue };
      }
    }

    return applyGrossRemainder(rows, mergedEmployee);
  }, [mergedEmployee, report, enrichment, payType]);

  const deductionRows = useMemo(() => {
    const calculated = employee?.calculated || {};
    const breakdown = calculated.deductionsBreakdown || employee?.deductionsBreakdown || {};
    const types = resolveTypes(
      report?.deductionTypes || enrichment?.deductionTypes,
      breakdown,
      FALLBACK_DEDUCTION_TYPES
    );
    return types.map((dt) => ({
      id: dt.id,
      label: dt.label || dt.code || dt.id,
      value: lookupBreakdown(breakdown, dt),
    }));
  }, [employee, report, enrichment]);

  const taxes = employee?.taxes && typeof employee.taxes === 'object' ? employee.taxes : {};

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) onClose();
  };

  const isFieldDisabled = (row) => {
    if (isSalaryType(row) && payType !== 'salary') return true;
    if (payType === 'salary' && (isRegularType(row) || isOvertimeType(row))) return true;
    return false;
  };

  return (
    <Dialog open={open && !!employee} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View Paycheck</DialogTitle>
          <DialogDescription className="sr-only">
            Paycheck breakdown for {employeeName}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <h3 className="text-lg font-semibold text-foreground truncate">{employeeName}</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ReadOnlyField
            id="paycheck-pay-date"
            label="Pay Date"
            type="date"
            value={toInputDate(report?.payDate)}
          />
          <ReadOnlyField
            id="paycheck-pay-from"
            label="Pay From"
            type="date"
            value={toInputDate(report?.periodStart)}
          />
          <ReadOnlyField
            id="paycheck-pay-to"
            label="Pay To"
            type="date"
            value={toInputDate(report?.periodEnd)}
          />
          <ReadOnlyField
            id="paycheck-check-number"
            label="Check Number"
            value={employee?.checkNumber || ''}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
          <div className="space-y-4">
            {earningRows.map((row) => (
              <ReadOnlyField
                key={row.id}
                id={`paycheck-earning-${row.id}`}
                label={row.label}
                value={formatAmount(row.value)}
                disabled={isFieldDisabled(row)}
              />
            ))}
            {earningRows.length === 0 && (
              <p className="text-sm text-muted-foreground">No earnings on this paycheck.</p>
            )}
          </div>

          <div className="space-y-4">
            {TAX_FIELDS.map((field) => (
              <ReadOnlyField
                key={field.key}
                id={`paycheck-tax-${field.key}`}
                label={field.label}
                value={formatAmount(taxValue(taxes, field.key))}
              />
            ))}
          </div>

          <div className="space-y-4">
            {deductionRows.map((row) => (
              <ReadOnlyField
                key={row.id}
                id={`paycheck-deduction-${row.id}`}
                label={row.label}
                value={formatAmount(row.value)}
              />
            ))}
            {deductionRows.length === 0 && (
              <p className="text-sm text-muted-foreground">No deductions on this paycheck.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViewPaycheckModal;
