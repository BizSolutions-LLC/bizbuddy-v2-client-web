import {
  PERIODS_PER_YEAR,
  calculateAdditionalEarning,
  calculateTaxes,
  getFederalTaxDetail,
  getStateTaxDetail,
  parseDecimal,
  resolveFilingStatus,
  round2,
} from "./payrollCompute.js";

/** Calculation type string for sheet-only quantity × rate columns (PRD D1). */
export const QTY_RATE_CALC_TYPE = "quantity_rate";

/**
 * Flip to true only after server accepts remark on mark-paid + PDF (PRD §10.1).
 * Keep false so production mark-paid never sends an unsupported field.
 */
export const PAYSLIP_REMARK_PERSISTENCE_ENABLED = true;

/** Empty employee tax object — used when "Disable taxes for this run" is on. */
export function emptyEmployeeTaxes() {
  return {
    fica: 0,
    medicare: 0,
    sdi: 0,
    federalTax: 0,
    stateTax: 0,
    calSavers: 0,
    additionalFed: 0,
    additionalState: 0,
    totalTaxes: 0,
  };
}

function emptyIncomeTaxDetail(employee, grossEarnings, payFrequency) {
  const periodsPerYear = PERIODS_PER_YEAR[payFrequency?.toLowerCase()] || 26;
  const periodGross = parseDecimal(grossEarnings);
  return {
    filingStatus: resolveFilingStatus(employee?.payrollDetails?.maritalStatus),
    periodsPerYear,
    periodGross,
    annualIncome: round2(periodGross * periodsPerYear),
    hasConfiguredBrackets: false,
    appliedBrackets: [],
    annualTax: 0,
    tax: 0,
    isExempt: true,
    isRunDisabled: true,
  };
}

/** amount = round2(quantity × rate). Empty/invalid → 0. */
export function calculateQuantityRateAmount(quantityInput, rateInput) {
  const quantity = parseDecimal(quantityInput);
  const rate = parseDecimal(rateInput);
  if (!quantity || !rate) return 0;
  return round2(quantity * rate);
}

/**
 * Sheet additional earning: quantity×rate uses qty/rate pair; fixed/percent keep a single input.
 */
export function calculateSheetAdditionalEarning(column, inputValue, baseGross, qtyRateInput) {
  if (column?.calculationType === QTY_RATE_CALC_TYPE) {
    return calculateQuantityRateAmount(qtyRateInput?.quantity, qtyRateInput?.rate);
  }
  return calculateAdditionalEarning(column, inputValue, baseGross);
}

export function taxesForSheetRun({
  employee,
  grossPay,
  taxRates,
  payFrequency,
  taxesDisabledForRun,
}) {
  if (taxesDisabledForRun) return emptyEmployeeTaxes();
  return calculateTaxes(employee, grossPay, taxRates, payFrequency);
}

export function federalTaxDetailForSheetRun({
  employee,
  grossPay,
  federalBrackets,
  payFrequency,
  taxesDisabledForRun,
}) {
  if (taxesDisabledForRun) {
    return {
      ...emptyIncomeTaxDetail(employee, grossPay, payFrequency),
      federalTax: 0,
    };
  }
  return getFederalTaxDetail(employee, grossPay, federalBrackets, payFrequency);
}

export function stateTaxDetailForSheetRun({
  employee,
  grossPay,
  stateBrackets,
  payFrequency,
  taxesDisabledForRun,
}) {
  if (taxesDisabledForRun) {
    return {
      ...emptyIncomeTaxDetail(employee, grossPay, payFrequency),
      stateTax: 0,
    };
  }
  return getStateTaxDetail(employee, grossPay, stateBrackets, payFrequency);
}

export function employerTaxesForSheetRun({
  taxesDisabledForRun,
  futaAmount,
  suiAmount,
  ettAmount,
}) {
  if (taxesDisabledForRun) {
    return {
      futaAmount: futaAmount == null ? null : 0,
      suiAmount: suiAmount == null ? null : 0,
      ettAmount: ettAmount == null ? null : 0,
    };
  }
  return { futaAmount, suiAmount, ettAmount };
}

export function sheetHasQuantityRateColumn(columns = []) {
  return columns.some((col) => col.calculationType === QTY_RATE_CALC_TYPE);
}

export function canAddQuantityRateColumn(columns = []) {
  return !sheetHasQuantityRateColumn(columns);
}

/**
 * Prefill sheet rate from profile pay rate. Does not write back to the employee.
 * Quantity starts blank for manual entry.
 */
export function prefillQtyRateFromEmployee(employeeLike) {
  const payRate =
    employeeLike?.payrollDetails?.payRate ?? employeeLike?.payRate ?? "";
  return {
    quantity: "",
    rate: payRate === null || payRate === undefined ? "" : String(payRate),
  };
}

export function isQuantityRateColumn(column) {
  return column?.calculationType === QTY_RATE_CALC_TYPE;
}
