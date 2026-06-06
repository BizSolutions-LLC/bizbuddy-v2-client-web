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
