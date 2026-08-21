export const PERIODS_PER_YEAR = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

// Federal and State are both bracket-based (see getBracketTaxDetail) and have no flat
// fallback rate — an empty brackets array below means $0 tax is computed, same as when
// a company has no brackets configured for an employee's filing status.
export const DEFAULT_TAX_RATES = {
  federalBrackets: [],
  stateBrackets: [],
  ficaRate: 0.062,
  medicareRate: 0.0145,
  sdiRate: 0.011,
  ficaWageBase: 168600,
};

/** Company federal brackets only cover single/head_of_household/married_filing_separately —
 * there's no plain "married" (joint) bracket, so map it to married_filing_separately. */
export function resolveFilingStatus(maritalStatus) {
  if (maritalStatus === "married") return "married_filing_separately";
  return maritalStatus || "single";
}

export function parseDecimal(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseFloat(value.toString().replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function round2(num) {
  return Math.round(num * 100) / 100;
}

export function getSalaryPerPeriod(annualSalary, payFrequency = "biweekly") {
  const periods = PERIODS_PER_YEAR[payFrequency?.toLowerCase()] || 26;
  return round2(parseDecimal(annualSalary) / periods);
}

export function calculateEarningValue(employee, earningType, hoursInput, payFrequency) {
  const payRate = parseDecimal(employee.payrollDetails?.payRate);
  const payType = employee.payrollDetails?.payType || "hourly";
  const earningRates = employee.earningRates || {};

  // Driver hours always use the employee Driver Rate, not regular payRate / custom earning rates.
  if (isDriverEarningType(earningType) && earningType.calculationType !== "flat") {
    const driverRate = parseDecimal(employee.payrollDetails?.driverPayRate);
    return round2(parseDecimal(hoursInput) * driverRate);
  }

  switch (earningType.calculationType) {
    case "flat":
      if (earningType.code === "salary" && payType === "salary") {
        return getSalaryPerPeriod(payRate, payFrequency);
      }
      return round2(parseDecimal(hoursInput));

    case "hourly":
      return round2(parseDecimal(hoursInput) * payRate);

    case "hourly_ot": {
      const otMultiplier = earningType.otMultiplier || 1.5;
      return round2(parseDecimal(hoursInput) * payRate * otMultiplier);
    }

    case "custom_rate": {
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

function normalizeEarningCode(code) {
  return String(code || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function isDriverEarningType(earningType) {
  const code = normalizeEarningCode(earningType?.code);
  return code === "driver" || code === "driver_hours" || code.includes("driver");
}

function isDriverEarningActive(earningType, payType) {
  if (!isDriverEarningType(earningType)) return false;
  if (payType === "salary" && ["hourly", "hourly_ot"].includes(earningType.calculationType)) return false;
  return true;
}

/** Map loaded punch/export hours onto a company earning type by code. */
export function resolveHoursForEarningType(earningType, hours) {
  const code = normalizeEarningCode(earningType?.code);

  if (earningType?.calculationType === "hourly" && code === "regular_hours") {
    return hours?.regularHours ?? 0;
  }
  if (earningType?.calculationType === "hourly_ot" && (code === "overtime" || code === "ot")) {
    return hours?.overtimeHours ?? 0;
  }

  if (code === "regular_hours" || code === "regular") return hours?.regularHours ?? 0;
  if (code === "overtime" || code === "ot" || code === "ot_hours") return hours?.overtimeHours ?? 0;
  if (isDriverEarningType(earningType)) {
    return hours?.driverHours ?? 0;
  }
  if (code === "training" || code === "training_hours" || code.includes("training")) {
    return hours?.trainingHours ?? 0;
  }
  if (code === "pto" || code === "pto_hours" || code.includes("pto")) {
    return hours?.ptoHours ?? 0;
  }

  return 0;
}

function applyFallbackGross(employee, enabledTypes, hours, payFrequency, grossEarnings, earningsBreakdown) {
  const payType = employee.payrollDetails?.payType || "hourly";
  const payRate = parseDecimal(employee.payrollDetails?.payRate);
  let fallbackGross = grossEarnings;

  if (payType === "salary" && !hasStandardEarningType(enabledTypes, "salary", "flat")) {
    const value = getSalaryPerPeriod(payRate, payFrequency);
    earningsBreakdown.__fallback_salary = value;
    fallbackGross += value;
  }

  if (payType === "hourly") {
    if (!hasStandardEarningType(enabledTypes, "regular_hours", "hourly")) {
      const regularHours = parseDecimal(hours?.regularHours ?? 0);
      const value = round2(regularHours * payRate);
      earningsBreakdown.__fallback_regular = value;
      fallbackGross += value;
    }

    if (!hasStandardEarningType(enabledTypes, "overtime", "hourly_ot")) {
      const otHours = parseDecimal(hours?.overtimeHours ?? 0);
      const otType = enabledTypes.find((et) => et.calculationType === "hourly_ot");
      const otMultiplier = otType?.otMultiplier || 1.5;
      const value = round2(otHours * payRate * otMultiplier);
      earningsBreakdown.__fallback_overtime = value;
      fallbackGross += value;
    }

    const hasPtoEarning = enabledTypes.some((et) => {
      const code = normalizeEarningCode(et.code);
      return code === "pto" || code === "pto_hours" || code.includes("pto");
    });
    if (!hasPtoEarning) {
      const ptoHours = parseDecimal(hours?.ptoHours ?? 0);
      if (ptoHours > 0) {
        const value = round2(ptoHours * payRate);
        earningsBreakdown.__fallback_pto = value;
        fallbackGross += value;
      }
    }
  }

  const hasDriverEarning = enabledTypes.some((et) => isDriverEarningActive(et, payType));
  if (!hasDriverEarning) {
    const driverHours = parseDecimal(hours?.driverHours ?? 0);
    const driverRate = parseDecimal(employee.payrollDetails?.driverPayRate);
    if (driverHours > 0 && driverRate > 0) {
      const value = round2(driverHours * driverRate);
      earningsBreakdown.__fallback_driver = value;
      fallbackGross += value;
    }
  }

  return round2(fallbackGross);
}

export function calculateGrossEarnings(employee, earningTypes, hours, payFrequency) {
  const payType = employee.payrollDetails?.payType || "hourly";
  let grossEarnings = 0;
  const earningsBreakdown = {};

  const enabledTypes = (earningTypes || []).filter((et) => et.enabled !== false);

  enabledTypes.forEach((et) => {
    if (payType === "salary" && ["hourly", "hourly_ot"].includes(et.calculationType)) {
      earningsBreakdown[et.id] = 0;
      return;
    }

    const hoursValue = resolveHoursForEarningType(et, hours);
    const value = calculateEarningValue(employee, et, hoursValue, payFrequency);
    earningsBreakdown[et.id] = value;
    grossEarnings += value;
  });

  grossEarnings = applyFallbackGross(employee, enabledTypes, hours, payFrequency, grossEarnings, earningsBreakdown);

  return {
    grossEarnings,
    earningsBreakdown,
  };
}

/**
 * Progressive per-bracket income tax, configured per company/filing status
 * (Company tab → Federal/State Income Tax Brackets), not a flat percentage of gross.
 * Shared by both Federal and State — same math, different bracket tables.
 *
 * Uses the IRS Pub 15-T "Annualized Wage Method": this period's actual taxable gross
 * (already reflects real hours/OT/salary — whatever calculateTaxes was called with) is
 * multiplied by the company's pay-periods-per-year to get an annualized wage estimate,
 * which is run progressively through the employee's filing-status brackets; the
 * resulting annual tax is divided back down to a per-period amount by the same factor.
 * This scales correctly for both full-time and part-time hourly employees (unlike a
 * fixed full-time-hours assumption), matching how real payroll systems withhold.
 *
 * Returns the full breakdown (annualized income, filing status, and the specific
 * bracket slices that were taxed) so the UI can explain the number, not just the amount.
 */
export function getBracketTaxDetail(employee, grossEarnings, brackets = [], payFrequency = "biweekly") {
  const allBrackets = brackets || [];
  const filingStatus = resolveFilingStatus(employee.payrollDetails?.maritalStatus);
  const periodsPerYear = PERIODS_PER_YEAR[payFrequency?.toLowerCase()] || 26;
  const periodGross = parseDecimal(grossEarnings);
  const annualIncome = round2(periodGross * periodsPerYear);

  const applicable = allBrackets
    .filter((b) => b.filingStatus === filingStatus)
    .sort((a, b) => parseDecimal(a.minAnnualIncome) - parseDecimal(b.minAnnualIncome));

  const appliedBrackets = [];
  let annualTax = 0;

  for (const bracket of applicable) {
    const min = parseDecimal(bracket.minAnnualIncome);
    if (annualIncome <= min) break;
    const max = bracket.maxAnnualIncome != null ? parseDecimal(bracket.maxAnnualIncome) : annualIncome;
    const taxableInBracket = Math.max(0, Math.min(annualIncome, max) - min);
    const rate = parseDecimal(bracket.rate);
    const taxForBracket = round2(taxableInBracket * rate);
    if (taxableInBracket > 0) {
      appliedBrackets.push({
        minAnnualIncome: min,
        maxAnnualIncome: bracket.maxAnnualIncome != null ? parseDecimal(bracket.maxAnnualIncome) : null,
        rate,
        taxableInBracket: round2(taxableInBracket),
        taxForBracket,
      });
    }
    annualTax += taxForBracket;
  }

  annualTax = round2(annualTax);
  const tax = round2(annualTax / periodsPerYear);

  return {
    filingStatus,
    periodsPerYear,
    periodGross,
    annualIncome,
    hasConfiguredBrackets: applicable.length > 0,
    appliedBrackets,
    annualTax,
    tax,
  };
}

/**
 * Per-employee flat-rate override (Employee tab → Federal/State Tax Rate = "Custom").
 * Bypasses the bracket lookup entirely: tax is simply this period's gross × rate, with
 * no annualization step (there's nothing progressive left to annualize against).
 * Shaped like getBracketTaxDetail's return value (minus filingStatus/brackets) so both
 * detail types can flow through the same tooltip/UI code via the `isCustomRate` flag.
 */
function getFlatRateTaxDetail(grossEarnings, ratePercent, payFrequency = "biweekly") {
  const periodsPerYear = PERIODS_PER_YEAR[payFrequency?.toLowerCase()] || 26;
  const periodGross = parseDecimal(grossEarnings);
  const rate = parseDecimal(ratePercent) / 100;
  const tax = round2(periodGross * rate);

  return {
    filingStatus: null,
    periodsPerYear,
    periodGross,
    annualIncome: round2(periodGross * periodsPerYear),
    hasConfiguredBrackets: false,
    appliedBrackets: [],
    annualTax: round2(tax * periodsPerYear),
    tax,
    isCustomRate: true,
    customRate: parseDecimal(ratePercent),
  };
}

function isExemptFlag(payrollDetails, flag, fallback = false) {
  if (payrollDetails?.[flag] == null) return Boolean(fallback);
  return Boolean(payrollDetails[flag]);
}

function isSocialSecurityExempt(payrollDetails) {
  return isExemptFlag(payrollDetails, "exemptSocialSecurity", payrollDetails?.skipFicaMedicare);
}

function isMedicareExempt(payrollDetails) {
  return isExemptFlag(payrollDetails, "exemptMedicare", payrollDetails?.skipFicaMedicare);
}

function getExemptTaxDetail(employee, grossEarnings, payFrequency) {
  const periodsPerYear = PERIODS_PER_YEAR[payFrequency?.toLowerCase()] || 26;
  const periodGross = parseDecimal(grossEarnings);
  return {
    filingStatus: resolveFilingStatus(employee.payrollDetails?.maritalStatus),
    periodsPerYear,
    periodGross,
    annualIncome: round2(periodGross * periodsPerYear),
    hasConfiguredBrackets: false,
    appliedBrackets: [],
    annualTax: 0,
    tax: 0,
    isExempt: true,
  };
}

export function getFederalTaxDetail(employee, grossEarnings, federalBrackets = [], payFrequency = "biweekly") {
  if (isExemptFlag(employee.payrollDetails, "exemptFederal")) {
    return { ...getExemptTaxDetail(employee, grossEarnings, payFrequency), federalTax: 0 };
  }
  const customRate = employee.payrollDetails?.customFederalRate;
  const detail =
    customRate != null
      ? getFlatRateTaxDetail(grossEarnings, customRate, payFrequency)
      : getBracketTaxDetail(employee, grossEarnings, federalBrackets, payFrequency);
  return { ...detail, federalTax: detail.tax };
}

export function calculateFederalTax(employee, grossEarnings, federalBrackets = [], payFrequency = "biweekly") {
  return getFederalTaxDetail(employee, grossEarnings, federalBrackets, payFrequency).federalTax;
}

export function getStateTaxDetail(employee, grossEarnings, stateBrackets = [], payFrequency = "biweekly") {
  if (isExemptFlag(employee.payrollDetails, "exemptPit")) {
    return { ...getExemptTaxDetail(employee, grossEarnings, payFrequency), stateTax: 0 };
  }
  const customRate = employee.payrollDetails?.customStateRate;
  const detail =
    customRate != null
      ? getFlatRateTaxDetail(grossEarnings, customRate, payFrequency)
      : getBracketTaxDetail(employee, grossEarnings, stateBrackets, payFrequency);
  return { ...detail, stateTax: detail.tax };
}

export function calculateStateTax(employee, grossEarnings, stateBrackets = [], payFrequency = "biweekly") {
  return getStateTaxDetail(employee, grossEarnings, stateBrackets, payFrequency).stateTax;
}

export function calculateTaxes(employee, grossEarnings, taxRates = DEFAULT_TAX_RATES, payFrequency = "biweekly") {
  const taxableGross = grossEarnings;
  const details = employee.payrollDetails;
  const skipSs = isSocialSecurityExempt(details);
  const skipMedicare = isMedicareExempt(details);
  const skipSdi = isExemptFlag(details, "exemptSdi");

  const fica = skipSs
    ? 0
    : round2(Math.min(taxableGross, taxRates.ficaWageBase ?? DEFAULT_TAX_RATES.ficaWageBase) * taxRates.ficaRate);

  const medicare = skipMedicare ? 0 : round2(taxableGross * taxRates.medicareRate);
  const sdi = skipSdi ? 0 : round2(taxableGross * taxRates.sdiRate);
  const federalTax = calculateFederalTax(employee, taxableGross, taxRates.federalBrackets, payFrequency);
  const stateTax = calculateStateTax(employee, taxableGross, taxRates.stateBrackets, payFrequency);

  const calSaversRate = employee.payrollDetails?.withCalSavers ? 0.05 : 0;
  const calSavers = round2(taxableGross * calSaversRate);

  const additionalFed = parseDecimal(employee.payrollDetails?.additionalFedIncomeTax);
  const additionalState = parseDecimal(employee.payrollDetails?.additionalStateIncomeTax);

  const totalTaxes = round2(fica + medicare + sdi + federalTax + stateTax + calSavers + additionalFed + additionalState);

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

  if (deductionType?.calculationType === "percent") {
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
  const driverPayRate = parseDecimal(employee.payrollDetails?.driverPayRate);

  if ((!payRate || payRate <= 0) && (!driverPayRate || driverPayRate <= 0)) {
    return {
      grossPay: null,
      taxes: null,
      deductions: null,
      netPay: null,
      error: "no_pay_rate",
    };
  }

  const { grossEarnings } = calculateGrossEarnings(employee, earningTypes, hours, payFrequency);
  const taxes = calculateTaxes(employee, grossEarnings, taxRates, payFrequency);
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
