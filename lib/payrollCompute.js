const PERIODS_PER_YEAR = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

export const DEFAULT_TAX_RATES = {
  federalRate: 0.12,
  stateRate: 0.05,
  ficaRate: 0.062,
  medicareRate: 0.0145,
  sdiRate: 0.011,
  ficaWageBase: 168600,
};

export function parseDecimal(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = parseFloat(value.toString().replace(/,/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function round2(num) {
  return Math.round(num * 100) / 100;
}

export function getSalaryPerPeriod(annualSalary, payFrequency = 'biweekly') {
  const periods = PERIODS_PER_YEAR[payFrequency?.toLowerCase()] || 26;
  return round2(parseDecimal(annualSalary) / periods);
}

export function calculateEarningValue(employee, earningType, hoursInput, payFrequency) {
  const payRate = parseDecimal(employee.payrollDetails?.payRate);
  const payType = employee.payrollDetails?.payType || 'hourly';
  const earningRates = employee.earningRates || {};

  switch (earningType.calculationType) {
    case 'flat':
      if (earningType.code === 'salary' && payType === 'salary') {
        return getSalaryPerPeriod(payRate, payFrequency);
      }
      return round2(parseDecimal(hoursInput));

    case 'hourly':
      return round2(parseDecimal(hoursInput) * payRate);

    case 'hourly_ot': {
      const otMultiplier = earningType.otMultiplier || 1.5;
      return round2(parseDecimal(hoursInput) * payRate * otMultiplier);
    }

    case 'custom_rate': {
      const customRate = parseDecimal(earningRates[earningType.id]);
      return round2(parseDecimal(hoursInput) * customRate);
    }

    default:
      return 0;
  }
}

function hasStandardEarningType(enabledTypes, code, calculationType) {
  return enabledTypes.some((et) => et.code === code && et.calculationType === calculationType);
}

function applyFallbackGross(employee, enabledTypes, hours, payFrequency, grossEarnings, earningsBreakdown) {
  const payType = employee.payrollDetails?.payType || 'hourly';
  const payRate = parseDecimal(employee.payrollDetails?.payRate);
  let fallbackGross = grossEarnings;

  if (payType === 'salary' && !hasStandardEarningType(enabledTypes, 'salary', 'flat')) {
    const value = getSalaryPerPeriod(payRate, payFrequency);
    earningsBreakdown.__fallback_salary = value;
    fallbackGross += value;
  }

  if (payType === 'hourly') {
    if (!hasStandardEarningType(enabledTypes, 'regular_hours', 'hourly')) {
      const regularHours = parseDecimal(hours?.regularHours ?? 0);
      const value = round2(regularHours * payRate);
      earningsBreakdown.__fallback_regular = value;
      fallbackGross += value;
    }

    if (!hasStandardEarningType(enabledTypes, 'overtime', 'hourly_ot')) {
      const otHours = parseDecimal(hours?.overtimeHours ?? 0);
      const otType = enabledTypes.find((et) => et.calculationType === 'hourly_ot');
      const otMultiplier = otType?.otMultiplier || 1.5;
      const value = round2(otHours * payRate * otMultiplier);
      earningsBreakdown.__fallback_overtime = value;
      fallbackGross += value;
    }
  }

  return round2(fallbackGross);
}

export function calculateGrossEarnings(employee, earningTypes, hours, payFrequency) {
  const payType = employee.payrollDetails?.payType || 'hourly';
  let grossEarnings = 0;
  const earningsBreakdown = {};

  const enabledTypes = (earningTypes || []).filter((et) => et.enabled !== false);

  enabledTypes.forEach((et) => {
    if (payType === 'salary' && ['hourly', 'hourly_ot'].includes(et.calculationType)) {
      earningsBreakdown[et.id] = 0;
      return;
    }

    let hoursValue = 0;
    if (et.calculationType === 'hourly' && et.code === 'regular_hours') {
      hoursValue = hours?.regularHours ?? 0;
    } else if (et.calculationType === 'hourly_ot' && et.code === 'overtime') {
      hoursValue = hours?.overtimeHours ?? 0;
    }

    const value = calculateEarningValue(employee, et, hoursValue, payFrequency);
    earningsBreakdown[et.id] = value;
    grossEarnings += value;
  });

  grossEarnings = applyFallbackGross(
    employee,
    enabledTypes,
    hours,
    payFrequency,
    grossEarnings,
    earningsBreakdown
  );

  return {
    grossEarnings,
    earningsBreakdown,
  };
}

export function calculateTaxes(employee, grossEarnings, taxRates = DEFAULT_TAX_RATES) {
  const taxableGross = grossEarnings;
  const skipFica = employee.payrollDetails?.skipFicaMedicare;

  const fica = skipFica
    ? 0
    : round2(Math.min(taxableGross, taxRates.ficaWageBase) * taxRates.ficaRate);

  const medicare = skipFica ? 0 : round2(taxableGross * taxRates.medicareRate);
  const sdi = round2(taxableGross * taxRates.sdiRate);
  const federalTax = round2(taxableGross * taxRates.federalRate);
  const stateTax = round2(taxableGross * taxRates.stateRate);

  const calSaversRate = employee.payrollDetails?.withCalSavers ? 0.05 : 0;
  const calSavers = round2(taxableGross * calSaversRate);

  const additionalFed = parseDecimal(employee.payrollDetails?.additionalFedIncomeTax);
  const additionalState = parseDecimal(employee.payrollDetails?.additionalStateIncomeTax);

  const totalTaxes = round2(
    fica + medicare + sdi + federalTax + stateTax + calSavers + additionalFed + additionalState
  );

  return {
    fica,
    medicare,
    sdi,
    federalTax,
    stateTax,
    calSavers,
    additionalFed,
    additionalState,
    totalTaxes,
  };
}

export function calculateDeductionValue(deductionType, inputValue, grossEarnings) {
  const raw = parseDecimal(inputValue);
  if (!raw) return 0;

  if (deductionType?.calculationType === 'percent') {
    return round2(parseDecimal(grossEarnings) * (raw / 100));
  }

  return round2(raw);
}

export const DEFAULT_FUTA_WAGE_CAP = 7000;

export function getFutaTaxableWages(grossPay, futaBalance) {
  const gross = parseDecimal(grossPay);
  const balance = parseDecimal(futaBalance);

  if (!gross || balance <= 0) return 0;

  return round2(Math.min(gross, balance));
}

export function calculateNewFutaBalance(grossPay, futaBalance) {
  const balance = parseDecimal(futaBalance);
  const taxable = getFutaTaxableWages(grossPay, balance);

  return round2(Math.max(0, balance - taxable));
}

export function calculateFutaDeduction(grossPay, futaBalance, futaRatePercent) {
  const rate = parseDecimal(futaRatePercent) / 100;

  if (!rate) return 0;

  const taxableAmount = getFutaTaxableWages(grossPay, futaBalance);
  if (!taxableAmount) return 0;

  return round2(taxableAmount * rate);
}

export function computeEmployeePayroll({
  employee,
  earningTypes,
  hours,
  payFrequency,
  deductions = 0,
  taxRates = DEFAULT_TAX_RATES,
}) {
  const payRate = parseDecimal(employee.payrollDetails?.payRate);

  if (!payRate || payRate <= 0) {
    return {
      grossPay: null,
      taxes: null,
      deductions: null,
      netPay: null,
      error: 'no_pay_rate',
    };
  }

  const { grossEarnings } = calculateGrossEarnings(employee, earningTypes, hours, payFrequency);
  const taxes = calculateTaxes(employee, grossEarnings, taxRates);
  const totalDeductions = round2(parseDecimal(deductions));
  const netPay = round2(grossEarnings - totalDeductions - taxes.totalTaxes);

  return {
    grossPay: grossEarnings,
    taxes: taxes.totalTaxes,
    deductions: totalDeductions,
    netPay,
    error: null,
  };
}
