/**
 * Demo payroll data when NEXT_PUBLIC_MOCK_PAYROLL=true and the API returns no records.
 * Toggle off in production by omitting or setting the env var to false.
 */

export const isMockPayrollEnabled = () =>
  process.env.NEXT_PUBLIC_MOCK_PAYROLL === "true";

export const isMockPayrollId = (id) =>
  typeof id === "string" && id.startsWith("mock-");

const period = (year, month, startDay, endDay) => ({
  periodStart: `${year}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
  periodEnd: `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
  payDate: `${year}-${String(month).padStart(2, "0")}-${String(endDay + 5).padStart(2, "0")}`,
});

const sarahMitchellId = "cmb1rn4ks0004wqdx5mtul7ud";

const MOCK_EARNING_TYPES = [
  { id: "et-regular", code: "regular_hours", label: "Regular", enabled: true },
  { id: "et-salary", code: "salary", label: "Salary", enabled: true },
  { id: "et-overtime", code: "overtime", label: "Overtime", enabled: true },
  { id: "et-pto", code: "pto", label: "PTO", enabled: true },
  { id: "et-driver", code: "driver", label: "Drivers/Aides Wages", enabled: true },
  { id: "et-training", code: "training", label: "Training", enabled: true },
];

const MOCK_DEDUCTION_TYPES = [
  { id: "dt-401k", code: "401k", label: "401K", enabled: true },
  { id: "dt-benefits", code: "benefits", label: "Employee Benefits", enabled: true },
  { id: "dt-advances", code: "advances", label: "Employee Advances", enabled: true },
  { id: "dt-officer", code: "officer_advances", label: "Officer's Advances", enabled: true },
  { id: "dt-garnishment", code: "garnishment", label: "Garnishment", enabled: true },
  { id: "dt-ded5", code: "ded5", label: "Ded 5", enabled: true },
];

const emptyEarnings = {
  "et-regular": 0,
  "et-salary": 0,
  "et-overtime": 0,
  "et-pto": 0,
  "et-driver": 0,
  "et-training": 0,
};

const emptyDeductions = {
  "dt-401k": 0,
  "dt-benefits": 0,
  "dt-advances": 0,
  "dt-officer": 0,
  "dt-garnishment": 0,
  "dt-ded5": 0,
};

const MOCK_EMPLOYEES_RUN_1 = [
  {
    employeeId: sarahMitchellId,
    employeeName: "Sarah Mitchell",
    position: "Director",
    payType: "salary",
    checkNumber: "6401",
    grossPay: 3269.23,
    totalTaxes: 1124.58,
    totalDeductions: 150,
    netPay: 1994.65,
    calculated: {
      grossEarnings: 3269.23,
      totalDeductions: 150,
      netPay: 3119.23,
      earningsBreakdown: { ...emptyEarnings, "et-salary": 3269.23 },
      deductionsBreakdown: { ...emptyDeductions, "dt-401k": 150 },
    },
    taxes: {
      federalTax: 450,
      stateTax: 180,
      fica: 202.69,
      medicare: 47.4,
      sdi: 35.96,
      calSavers: 208.53,
      totalTaxes: 1124.58,
    },
  },
  {
    employeeId: "cmb1rn4ks0009wqdxaryzq2zi",
    employeeName: "Amanda Brown",
    position: "Teacher",
    payType: "hourly",
    checkNumber: "6402",
    grossPay: 1680,
    totalTaxes: 512.4,
    totalDeductions: 45,
    netPay: 1122.6,
    calculated: {
      grossEarnings: 1680,
      totalDeductions: 45,
      netPay: 1635,
      earningsBreakdown: { ...emptyEarnings, "et-regular": 1680 },
      deductionsBreakdown: { ...emptyDeductions, "dt-benefits": 45 },
    },
    taxes: {
      federalTax: 168,
      stateTax: 67.2,
      fica: 104.16,
      medicare: 24.36,
      sdi: 18.48,
      calSavers: 130.2,
      totalTaxes: 512.4,
    },
  },
  {
    employeeId: "cmb1rn4ks0007wqdx8pwxo0xg",
    employeeName: "Carlos Rodriguez",
    position: "Teacher",
    payType: "hourly",
    checkNumber: "6403",
    grossPay: 1848,
    totalTaxes: 563.71,
    totalDeductions: 45,
    netPay: 1239.29,
    calculated: {
      grossEarnings: 1848,
      totalDeductions: 45,
      netPay: 1803,
      earningsBreakdown: { ...emptyEarnings, "et-regular": 1680, "et-overtime": 168 },
      deductionsBreakdown: { ...emptyDeductions, "dt-benefits": 45 },
    },
    taxes: {
      federalTax: 184.8,
      stateTax: 73.92,
      fica: 114.58,
      medicare: 26.8,
      sdi: 20.33,
      calSavers: 143.28,
      totalTaxes: 563.71,
    },
  },
];

const p1 = period(2026, 5, 1, 15);
const p2 = period(2026, 5, 16, 31);

export const MOCK_PAYSLIPS = [
  {
    id: "mock-payslip-1",
    payrollRunId: "mock-run-1",
    ...p1,
    checkNumber: "6401",
    grossPay: 3269.23,
    taxes: 1124.58,
    deductions: 150,
    netPay: 1994.65,
    isMock: true,
  },
  {
    id: "mock-payslip-2",
    payrollRunId: "mock-run-2",
    ...p2,
    checkNumber: "6410",
    grossPay: 3269.23,
    taxes: 1124.58,
    deductions: 150,
    netPay: 1994.65,
    isMock: true,
  },
];

export const MOCK_PAYROLL_REPORTS = [
  {
    id: "mock-run-1",
    ...p1,
    checkNumberStart: "6401",
    totalGross: 6797.23,
    totalTaxes: 2200.69,
    totalDeductions: 240,
    totalNet: 4356.54,
    employeeCount: 3,
    employees: MOCK_EMPLOYEES_RUN_1,
    earningTypes: MOCK_EARNING_TYPES,
    deductionTypes: MOCK_DEDUCTION_TYPES,
    isMock: true,
  },
  {
    id: "mock-run-2",
    ...p2,
    checkNumberStart: "6410",
    totalGross: 6520.5,
    totalTaxes: 2110.32,
    totalDeductions: 220,
    totalNet: 4190.18,
    employeeCount: 3,
    employees: MOCK_EMPLOYEES_RUN_1.map((e, i) => ({
      ...e,
      checkNumber: String(6410 + i),
    })),
    earningTypes: MOCK_EARNING_TYPES,
    deductionTypes: MOCK_DEDUCTION_TYPES,
    isMock: true,
  },
];

export function withMockPayslips(payslips) {
  if (!isMockPayrollEnabled() || (payslips?.length ?? 0) > 0) {
    return payslips ?? [];
  }
  return MOCK_PAYSLIPS;
}

export function withMockPayrollReports(reports) {
  if (!isMockPayrollEnabled() || (reports?.length ?? 0) > 0) {
    return reports ?? [];
  }
  return MOCK_PAYROLL_REPORTS;
}
